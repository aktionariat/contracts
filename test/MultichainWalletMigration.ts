// Fork test for the one-time multisig migration (scripts/migration/redeployMultisigs.ts).
//
// Exercises the REAL deployed factory (0xfed81...) against REAL company signer data from
// scripts/migration/affectedCompanies.ts, on forks of the live chains:
//   - mainnet fork: createWithSigners sets the exact signer set; sync() quotes the real CCIP
//     fee, pulls LINK from the caller and calls the real router (proves it does not revert).
//   - polygon fork: the clone lands at the same address and is signer-less after
//     createWithSigners; a mainnet-sourced CCIP message applied by the (impersonated) router
//     populates the signers with the correct powers.
//
// CCIP delivery is off-chain, so the two forks are not bridged: the L2 receive is simulated
// by impersonating the destination router and calling ccipReceive directly, exactly as
// test/MultichainWallet.ts does.
//
// Run: npx hardhat test test/MultichainWalletMigration.ts

import hre from "hardhat";
import { expect } from "chai";
import { Contract } from "ethers";
import { provider, ethers, deployer } from "./TestBase.ts";
import { AFFECTED_COMPANIES } from "../scripts/migration/affectedCompanies.ts";

const FACTORY = "0xfed81dace77c0d11cace61304ec60efcd04379a9";

const ROUTER = {
  mainnet: "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D",
  polygon: "0x849c5ED5a80F5B408Dd4969b78c2C8fdf0565Bfe",
};
const LINK = {
  mainnet: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  polygon: "0xb0897686c545045aFc77CF20eC7A532E3120E0F1",
};
const SELECTOR = {
  mainnet: 5009297550715157269n,
  optimism: 3734403246176062136n,
  polygon: 4051577828743386545n,
};

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

// Representative slice of the scoped set: a 5-signer mixed-power wallet, a 3-signer one, and a
// single-signer one. (Picked by id so the test stays meaningful if the dataset is reordered.)
const SAMPLE_IDS = [58400, 65382, 68669]; // wildbieneundpartner, caveo, skribble
const samples = SAMPLE_IDS.map((id) => {
  const c = AFFECTED_COMPANIES.find((x) => x.id === id);
  if (!c) throw new Error(`sample company ${id} not in affectedCompanies.ts`);
  return c;
});

// Gives `account` a LINK balance on a fork by probing for the balances mapping slot.
async function setForkedTokenBalance(prov: any, eth: any, token: string, account: string, amount: bigint) {
  const abi = eth.AbiCoder.defaultAbiCoder();
  const erc20 = new eth.Contract(token, ERC20_ABI, eth.provider);
  const value = eth.toBeHex(amount, 32);
  for (let slot = 0; slot < 20; slot++) {
    const index = eth.keccak256(abi.encode(["address", "uint256"], [account, slot]));
    const previous = await prov.request({ method: "eth_getStorageAt", params: [token, index, "latest"] });
    await prov.request({ method: "hardhat_setStorageAt", params: [token, index, value] });
    if ((await erc20.balanceOf(account)) === amount) return;
    await prov.request({ method: "hardhat_setStorageAt", params: [token, index, previous] });
  }
  throw new Error(`balances slot of ${token} not found`);
}

describe("Migration: deploy + sync on mainnet fork", function () {
  this.timeout(600000);

  let factory: Contract;
  let link: Contract;

  before(async function () {
    factory = await ethers.getContractAt("MultichainWalletFactory", FACTORY, deployer);
    link = new ethers.Contract(LINK.mainnet, ERC20_ABI, deployer);
    await setForkedTokenBalance(provider, ethers, LINK.mainnet, deployer.address, ethers.parseEther("1000"));
  });

  for (const co of samples) {
    it(`deploys ${co.name} (${co.id}) with its exact ${co.signers.length}-signer set`, async function () {
      const predicted = await factory.predict(co.salt);
      expect(predicted.toLowerCase()).to.equal(co.newMultisig.toLowerCase());
      if ((await ethers.provider.getCode(predicted)) !== "0x") {
        this.skip(); // already deployed on the forked chain (e.g. migration already ran on real mainnet)
      }

      await (await factory.createWithSigners(co.signers, co.powers, co.salt)).wait();

      const wallet = await ethers.getContractAt("MultichainWalletMaster", predicted);
      expect(await wallet.signerCount()).to.equal(BigInt(co.signers.length));
      for (let i = 0; i < co.signers.length; i++) {
        expect(await wallet.signers(co.signers[i])).to.equal(BigInt(co.powers[i]));
      }
      // the wallet is implicitly its own signer with power 1, but that must not be a stored signer
      expect(await wallet.signers(predicted)).to.equal(1n);
    });
  }

  it(`syncs a wallet's signers from mainnet to optimism + polygon over the real router`, async function () {
    const co = samples[0]; // wildbieneundpartner: 5 signers
    const wallet = await ethers.getContractAt("MultichainWalletMaster", co.newMultisig, deployer);
    if ((await ethers.provider.getCode(co.newMultisig)) === "0x") this.skip();

    await (await link.approve(co.newMultisig, ethers.parseEther("100"))).wait();
    const linkBefore = await link.balanceOf(deployer.address);

    const tx = await wallet["sync(uint64[],address[])"]([SELECTOR.optimism, SELECTOR.polygon], co.signers);
    const receipt = await tx.wait();

    // one SyncSent per (target, signer); the caller paid LINK; the wallet's own funds are untouched
    const syncSent = receipt.logs
      .filter((l: any) => l.address.toLowerCase() === co.newMultisig.toLowerCase())
      .map((l: any) => wallet.interface.parseLog(l))
      .filter((l: any) => l?.name === "SyncSent");
    expect(syncSent.length).to.equal(2 * co.signers.length);
    expect(linkBefore - (await link.balanceOf(deployer.address))).to.be.greaterThan(0n);
    expect(await link.balanceOf(co.newMultisig)).to.equal(0n);
  });
});

describe("Migration: L2 clone + simulated CCIP receive on polygon fork", function () {
  this.timeout(600000);

  let l2Ethers: any;
  let l2Provider: any;
  let l2Deployer: any;
  let factory: Contract;

  before(async function () {
    const l2 = await hre.network.connect("hardhatPolygon");
    l2Ethers = l2.ethers;
    l2Provider = l2.provider;
    // Mine one block on top of the fork: EDR has no hardfork history for polygon's historical
    // fork block, so eth_call at that block reverts. Executing on a freshly-mined block (which
    // uses the node's configured hardfork) avoids that; state is carried over from the fork.
    await l2Provider.request({ method: "hardhat_mine", params: ["0x1"] });
    [l2Deployer] = await l2Ethers.getSigners();
    factory = await l2Ethers.getContractAt("MultichainWalletFactory", FACTORY, l2Deployer);
  });

  for (const co of samples) {
    it(`deploys a signer-less ${co.name} clone on polygon, then applies signers via ccipReceive`, async function () {
      const predicted = await factory.predict(co.salt);
      expect(predicted.toLowerCase()).to.equal(co.newMultisig.toLowerCase());
      if ((await l2Ethers.provider.getCode(predicted)) !== "0x") this.skip();

      // On L2 the signer list is ignored: even a would-be front-runner gets a signer-less wallet.
      await (await factory.createWithSigners(co.signers, co.powers, co.salt)).wait();
      const wallet = await l2Ethers.getContractAt("MultichainWalletMaster", predicted);
      expect(await wallet.signerCount()).to.equal(0n);
      expect(await wallet.LINK()).to.equal(LINK.polygon);

      // Simulate CCIP delivery: the destination router calls ccipReceive with a mainnet-sourced
      // message whose sender is the wallet's own (cross-chain identical) address.
      await l2Provider.request({ method: "hardhat_impersonateAccount", params: [ROUTER.polygon] });
      await l2Provider.request({ method: "hardhat_setBalance", params: [ROUTER.polygon, "0x1000000000000000000"] });
      const routerSigner = await l2Ethers.getSigner(ROUTER.polygon);
      const abi = l2Ethers.AbiCoder.defaultAbiCoder();
      const message = {
        messageId: l2Ethers.id(`sync-${co.id}`),
        sourceChainSelector: SELECTOR.mainnet,
        sender: abi.encode(["address"], [predicted]),
        data: abi.encode(["address[]", "uint8[]"], [co.signers, co.powers]),
        destTokenAmounts: [],
      };
      await (await wallet.connect(routerSigner).ccipReceive(message)).wait();

      expect(await wallet.signerCount()).to.equal(BigInt(co.signers.length));
      for (let i = 0; i < co.signers.length; i++) {
        expect(await wallet.signers(co.signers[i])).to.equal(BigInt(co.powers[i]));
      }
    });
  }
});
