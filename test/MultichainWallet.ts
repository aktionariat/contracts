import hre from "hardhat";
import { expect } from "chai";
import { Contract } from "ethers";
import { connection, provider, ethers, deployer, owner, signer1, signer2, signer3 } from "./TestBase.ts";

// LINK-only MultichainWallet tests, run against real forked chains:
// - mainnet fork (default connection, chainid 1): real CCIP router + real LINK, no mocks.
// - polygon fork (separate connection, chainid 137): non-mainnet clone semantics, CCIP
//   receive, and verification that CCIP accepts the PoS-bridged polygon LINK as fee token.
//   (Polygon rather than optimism because EDR's op chain type currently cannot build
//   blocks on an optimism fork: "Unsupported base fee params version".)

const ROUTER = {
  mainnet: "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D",
  optimism: "0x3206695CaE29952f4b0c22a169725a865bc8Ce0f",
  polygon: "0x849c5ED5a80F5B408Dd4969b78c2C8fdf0565Bfe",
};
const LINK = {
  mainnet: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  optimism: "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6",
  polygon: "0xb0897686c545045aFc77CF20eC7A532E3120E0F1", // native ERC677 LINK, the one CCIP accepts
  polygonPoS: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39", // PoS-bridged LINK, rejected with NotAFeeToken

};
const SELECTOR = {
  mainnet: 5009297550715157269n,
  optimism: 3734403246176062136n,
  polygon: 4051577828743386545n,
};
// Deterministic deployment proxy, deployed on virtually every chain
const CREATE2_PROXY = "0x4e59b44847b379578588920cA78FbF26c0B4956C";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
];
const ROUTER_ABI = [
  "function getFee(uint64 destinationChainSelector, (bytes receiver, bytes data, (address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) view returns (uint256)",
];

const abi = ethers.AbiCoder.defaultAbiCoder();

// Rebuilds the exact EVM2AnyMessage that MultichainWallet._buildSyncMessage produces,
// so the expected fee can be read from the real router with getFee.
function buildSyncMessage(wallet: string, signerList: string[], powers: number[], feeToken: string) {
  return {
    receiver: abi.encode(["address"], [wallet]),
    data: abi.encode(["address[]", "uint8[]"], [signerList, powers]),
    tokenAmounts: [],
    feeToken: feeToken,
    extraArgs: ethers.concat([
      "0x181dcf10", // Client.GENERIC_EXTRA_ARGS_V2_TAG
      abi.encode(["uint256", "bool"], [100_000, true]),
    ]),
  };
}

// Gives `account` a LINK balance on a fork by probing for the balances mapping slot.
async function setForkedTokenBalance(prov: any, eth: any, token: string, account: string, amount: bigint) {
  const erc20 = new ethers.Contract(token, ERC20_ABI, eth.provider);
  const value = ethers.toBeHex(amount, 32);
  for (let slot = 0; slot < 20; slot++) {
    const index = ethers.keccak256(abi.encode(["address", "uint256"], [account, slot]));
    const previous = await prov.request({ method: "eth_getStorageAt", params: [token, index, "latest"] });
    await prov.request({ method: "hardhat_setStorageAt", params: [token, index, value] });
    if (await erc20.balanceOf(account) === amount) return;
    await prov.request({ method: "hardhat_setStorageAt", params: [token, index, previous] });
  }
  throw new Error(`balances slot of ${token} not found`);
}

// Deploys the LINK-only stack (Rollout -> source/master/factory) with the given per-chain arguments.
async function deployStack(eth: any, routerAddr: string, linkAddr: string) {
  const Rollout = await eth.getContractFactory("Rollout");
  const rollout = await Rollout.deploy();
  await rollout.waitForDeployment();
  const factoryAddress = await rollout.rollout.staticCall(routerAddr, linkAddr);
  await (await rollout.rollout(routerAddr, linkAddr)).wait();
  const factory = await eth.getContractAt("MultichainWalletFactory", factoryAddress);
  return { rollout, factory };
}

async function createWallet(eth: any, factory: Contract, ownerAddress: string, salt: string) {
  const walletAddress = await factory.predict(salt);
  await (await factory.create(ownerAddress, salt)).wait();
  return eth.getContractAt("MultichainWalletMaster", walletAddress);
}

describe("MultichainWallet LINK-only sync", function () {
  this.timeout(600000);

  let factory: Contract;
  let wallet: Contract;
  let link: Contract;
  let router: Contract;
  const salt = ethers.encodeBytes32String("TESTCOMPANY");

  before(async function () {
    ({ factory } = await deployStack(ethers, ROUTER.mainnet, LINK.mainnet));
    wallet = await createWallet(ethers, factory, owner.address, salt);
    link = new ethers.Contract(LINK.mainnet, ERC20_ABI, deployer);
    router = new ethers.Contract(ROUTER.mainnet, ROUTER_ABI, ethers.provider);
    await setForkedTokenBalance(provider, ethers, LINK.mainnet, deployer.address, ethers.parseEther("1000"));
  });

  it("should store LINK as immutable fee token", async function () {
    expect(await wallet.LINK()).to.equal(LINK.mainnet);
  });

  it("should not expose a payable sync or a fee token choice", async function () {
    for (const signature of ["sync(uint64[],address[])", "sync(uint64,address)", "sync(uint64,address[])"]) {
      expect(wallet.interface.getFunction(signature)?.payable).to.be.false;
    }
    let feeTokenOverload = null;
    try { feeTokenOverload = wallet.interface.getFunction("sync(uint64,address[],address)"); } catch {}
    expect(feeTokenOverload).to.be.null;
    await expect(deployer.sendTransaction({
      to: await wallet.getAddress(),
      data: wallet.interface.encodeFunctionData("sync(uint64,address)", [SELECTOR.optimism, owner.address]),
      value: 1n,
    })).to.be.revert(ethers); // non-payable dispatch rejects msg.value
  });

  it("should revert sync if the caller has not approved LINK", async function () {
    expect(await link.allowance(deployer.address, await wallet.getAddress())).to.equal(0n);
    await expect(wallet.connect(deployer)["sync(uint64,address)"](SELECTOR.optimism, owner.address))
      .to.be.revert(ethers);
  });

  it("should pull exactly the CCIP fee in LINK from the caller", async function () {
    const walletAddress = await wallet.getAddress();
    const message = buildSyncMessage(walletAddress, [owner.address], [1], LINK.mainnet);
    const fee = await router.getFee(SELECTOR.optimism, message);
    expect(fee).to.be.greaterThan(0n);

    await (await link.approve(walletAddress, fee)).wait();
    const callerBefore = await link.balanceOf(deployer.address);
    const walletLinkBefore = await link.balanceOf(walletAddress);
    const walletEthBefore = await ethers.provider.getBalance(walletAddress);

    const tx = await wallet.connect(deployer)["sync(uint64,address)"](SELECTOR.optimism, owner.address);
    const receipt = await tx.wait();

    expect(callerBefore - await link.balanceOf(deployer.address)).to.equal(fee);
    expect(await link.balanceOf(walletAddress)).to.equal(walletLinkBefore); // wallet's own funds untouched
    expect(await ethers.provider.getBalance(walletAddress)).to.equal(walletEthBefore);
    expect(await link.allowance(walletAddress, ROUTER.mainnet)).to.equal(0n); // router consumed the exact approval

    const syncSent = receipt.logs.filter((l: any) => l.address === walletAddress)
      .map((l: any) => wallet.interface.parseLog(l)).filter((l: any) => l?.name === "SyncSent");
    expect(syncSent.length).to.equal(1);
    expect(syncSent[0].args[2]).to.equal(owner.address);
    expect(syncSent[0].args[3]).to.equal(1n);
  });

  it("should pull one fee per target from the caller in a batch sync", async function () {
    const walletAddress = await wallet.getAddress();
    const signerList = [owner.address, signer1.address];
    const powers = [1, 0]; // signer1 is not a signer, syncs power 0
    const message = buildSyncMessage(walletAddress, signerList, powers, LINK.mainnet);
    const feeOptimism = await router.getFee(SELECTOR.optimism, message);
    const feePolygon = await router.getFee(SELECTOR.polygon, message);
    const totalFee = feeOptimism + feePolygon;

    await (await link.approve(walletAddress, totalFee)).wait();
    const callerBefore = await link.balanceOf(deployer.address);
    const walletLinkBefore = await link.balanceOf(walletAddress);

    const tx = await wallet.connect(deployer)["sync(uint64[],address[])"]([SELECTOR.optimism, SELECTOR.polygon], signerList);
    const receipt = await tx.wait();

    expect(callerBefore - await link.balanceOf(deployer.address)).to.equal(totalFee);
    expect(await link.balanceOf(walletAddress)).to.equal(walletLinkBefore);

    const syncSent = receipt.logs.filter((l: any) => l.address === walletAddress)
      .map((l: any) => wallet.interface.parseLog(l)).filter((l: any) => l?.name === "SyncSent");
    expect(syncSent.length).to.equal(4); // 2 targets x 2 signers
    const chains = syncSent.map((l: any) => l.args[1]);
    expect(chains).to.deep.equal([SELECTOR.optimism, SELECTOR.optimism, SELECTOR.polygon, SELECTOR.polygon]);
  });

  it("should revert a batch sync if the approval only covers part of the fees", async function () {
    const walletAddress = await wallet.getAddress();
    const message = buildSyncMessage(walletAddress, [owner.address], [1], LINK.mainnet);
    const feeOptimism = await router.getFee(SELECTOR.optimism, message);
    await (await link.approve(walletAddress, feeOptimism)).wait(); // not enough for both targets
    await expect(wallet.connect(deployer)["sync(uint64[],address[])"]([SELECTOR.optimism, SELECTOR.polygon], [owner.address]))
      .to.be.revert(ethers);
    await (await link.approve(walletAddress, 0n)).wait();
  });
});

describe("MultichainWalletFactory createWithSigners", function () {
  this.timeout(600000);

  let factory: Contract;

  before(async function () {
    ({ factory } = await deployStack(ethers, ROUTER.mainnet, LINK.mainnet));
  });

  it("should set the full signer set atomically on mainnet, at the same address as create would", async function () {
    const salt = ethers.encodeBytes32String("WITHSIGNERS");
    const predicted = await factory.predict(salt); // independent of the signer list
    const signerList = [signer1.address, signer2.address, signer3.address];
    const powers = [2, 2, 2];
    await (await factory.createWithSigners(signerList, powers, salt)).wait();
    const wallet = await ethers.getContractAt("MultichainWalletMaster", predicted);
    expect(await wallet.signerCount()).to.equal(3n);
    for (const signer of signerList) {
      expect(await wallet.signers(signer)).to.equal(2n);
    }
  });

  it("should not allow initializing twice", async function () {
    const salt = ethers.encodeBytes32String("WITHSIGNERS");
    const wallet = await ethers.getContractAt("MultichainWalletMaster", await factory.predict(salt));
    await expect(wallet.initialize(signer1.address)).to.be.revertedWithCustomError(wallet, "Initializable_AlreadyInitalized");
    await expect(wallet.initializeWithSigners([signer1.address], [1])).to.be.revertedWithCustomError(wallet, "Initializable_AlreadyInitalized");
  });

  it("should reject an empty or mismatched signer list", async function () {
    const master = await ethers.getContractAt("MultichainWalletMaster", await factory.IMPLEMENTATION());
    await expect(factory.createWithSigners([], [], ethers.encodeBytes32String("EMPTY")))
      .to.be.revertedWithCustomError(master, "Multisig_InsufficientSigners");
    await expect(factory.createWithSigners([signer1.address], [1, 1], ethers.encodeBytes32String("MISMATCH")))
      .to.be.revertedWithCustomError(master, "Multisig_LengthMismatch");
  });
});

describe("MultichainWallet on a forked L2 (polygon)", function () {
  this.timeout(600000);

  let l2Connection: any;
  let l2Ethers: any;
  let l2Provider: any;
  let l2Deployer: any;
  let factory: Contract;

  before(async function () {
    l2Connection = await hre.network.connect("hardhatPolygon");
    l2Ethers = l2Connection.ethers;
    l2Provider = l2Connection.provider;
    [l2Deployer] = await l2Ethers.getSigners();
    ({ factory } = await deployStack(l2Ethers, ROUTER.polygon, LINK.polygon));
  });

  it("should confirm the polygon CCIP router accepts the native ERC677 LINK as fee token", async function () {
    // Guards against the two-LINKs-on-polygon trap: the fee quote must work with the
    // LINK address baked into the argument source, and fail with the other LINK.
    const polygonRouter = new l2Ethers.Contract(ROUTER.polygon, ROUTER_ABI, l2Ethers.provider);
    const message = buildSyncMessage(l2Deployer.address, [l2Deployer.address], [1], LINK.polygon);
    expect(await polygonRouter.getFee(SELECTOR.mainnet, message)).to.be.greaterThan(0n);
    const wrongLinkMessage = buildSyncMessage(l2Deployer.address, [l2Deployer.address], [1], LINK.polygonPoS);
    await expect(polygonRouter.getFee(SELECTOR.mainnet, wrongLinkMessage)).to.be.revert(l2Ethers); // NotAFeeToken
  });

  it("should ignore the signer list of createWithSigners outside of mainnet", async function () {
    // A front-runner deploying a company's canonical address on an L2 with their own
    // signer list must end up with a signer-less wallet.
    const salt = ethers.encodeBytes32String("FRONTRUN");
    const predicted = await factory.predict(salt);
    await (await factory.createWithSigners([l2Deployer.address], [1], salt)).wait();
    const wallet = await l2Ethers.getContractAt("MultichainWalletMaster", predicted);
    expect(await wallet.LINK()).to.equal(LINK.polygon);
    expect(await wallet.signerCount()).to.equal(0n);
    expect(await wallet.signers(l2Deployer.address)).to.equal(0n);
  });

  it("should accept a signer sync from mainnet via the router", async function () {
    const salt = ethers.encodeBytes32String("FRONTRUN");
    const wallet = await l2Ethers.getContractAt("MultichainWalletMaster", await factory.predict(salt));
    const walletAddress = await wallet.getAddress();

    await l2Provider.request({ method: "hardhat_impersonateAccount", params: [ROUTER.polygon] });
    await l2Provider.request({ method: "hardhat_setBalance", params: [ROUTER.polygon, "0x1000000000000000000"] });
    const routerSigner = await l2Ethers.getSigner(ROUTER.polygon);

    const message = {
      messageId: ethers.id("test-message"),
      sourceChainSelector: SELECTOR.mainnet,
      sender: abi.encode(["address"], [walletAddress]), // wallets share one address across chains
      data: abi.encode(["address[]", "uint8[]"], [[signer1.address, signer2.address], [2, 2]]),
      destTokenAmounts: [],
    };
    await (await wallet.connect(routerSigner).ccipReceive(message)).wait();

    expect(await wallet.signerCount()).to.equal(2n);
    expect(await wallet.signers(signer1.address)).to.equal(2n);
    expect(await wallet.signers(signer2.address)).to.equal(2n);
  });
});

describe("Rollout cross-chain determinism", function () {
  this.timeout(600000);

  it("should yield the same rollout and factory addresses on mainnet and polygon", async function () {
    const Rollout = await ethers.getContractFactory("Rollout");
    const proxySalt = ethers.id("multichain-wallet-update-test");
    const initcode = Rollout.bytecode;
    const expectedRollout = ethers.getCreate2Address(CREATE2_PROXY, proxySalt, ethers.keccak256(initcode));

    // Mainnet fork: deploy through the deterministic deployment proxy
    await (await deployer.sendTransaction({ to: CREATE2_PROXY, data: ethers.concat([proxySalt, initcode]) })).wait();
    expect(await ethers.provider.getCode(expectedRollout)).to.not.equal("0x");
    const rolloutMainnet = await ethers.getContractAt("Rollout", expectedRollout);
    const factoryMainnet = await rolloutMainnet.rollout.staticCall(ROUTER.mainnet, LINK.mainnet);
    await (await rolloutMainnet.rollout(ROUTER.mainnet, LINK.mainnet)).wait();

    // Polygon fork: same proxy, same salt, same initcode, different rollout arguments
    const l2Connection = await hre.network.connect("hardhatPolygon");
    const [l2Deployer] = await l2Connection.ethers.getSigners();
    await (await l2Deployer.sendTransaction({ to: CREATE2_PROXY, data: ethers.concat([proxySalt, initcode]) })).wait();
    expect(await l2Connection.ethers.provider.getCode(expectedRollout)).to.not.equal("0x");
    const rolloutPolygon = await l2Connection.ethers.getContractAt("Rollout", expectedRollout);
    const factoryPolygon = await rolloutPolygon.rollout.staticCall(ROUTER.polygon, LINK.polygon);
    await (await rolloutPolygon.rollout(ROUTER.polygon, LINK.polygon)).wait();

    expect(factoryPolygon).to.equal(factoryMainnet);

    // The per-chain arguments live in storage, not in any address derivation
    const factory = await l2Connection.ethers.getContractAt("MultichainWalletFactory", factoryPolygon);
    const master = await l2Connection.ethers.getContractAt("MultichainWalletMaster", await factory.IMPLEMENTATION());
    expect(await master.LINK()).to.equal(LINK.polygon);
  });
});
