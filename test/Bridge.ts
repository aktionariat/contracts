import { expect } from "chai";
import { Contract } from "ethers";
import { connection, deployer, ethers, owner, signer1, signer2, signer3 } from "./TestBase.ts";
import { UNISWAP_QUOTER_V2, UNISWAP_UNIVERSAL_ROUTER, ZCHF_ADDRESS, mintAndWrap } from "./Fixtures.ts";
import { CHAINLINK_MAINNET, POLYGON_SELECTOR, POOL_ABI, LOCKBOX_ABI, ROUTER_ABI, chainUpdate } from "./Chainlink.ts";

// Bridging a restricted wrapper through the real Chainlink pool and lockbox the factory deployed, on the mainnet
// fork. The router's on-ramp and off-ramp are impersonated, so lockOrBurn and releaseOrMint run exactly as CCIP
// would call them; the allowlist rules of the wrapper decide what passes.

const CREATE2_PROXY = "0x4e59b44847b379578588920ca78fbf26c0b4956c";
const FACTORY_SALT = ethers.id("AktionariatFactory bridge test");
const TYPE_ALLOWED = 1n;
const REMOTE_POOL = "0x000000000000000000000000000000000000BEEF"; // the burn-mint pool on the other chain

describe("Bridge (lock-release pool and lockbox on the home chain)", function () {
  let wrapper: Contract;
  let shares: Contract;
  let pool: Contract;
  let lockBox: Contract;
  let onRamp: any;
  let offRamp: any;
  const coder = ethers.AbiCoder.defaultAbiCoder();

  async function setup() {
    const Factory = await ethers.getContractFactory("AktionariatFactory");
    const initCode = ethers.concat([Factory.bytecode, coder.encode(["address"], [deployer.address])]);
    const predicted = ethers.getCreate2Address(CREATE2_PROXY, FACTORY_SALT, ethers.keccak256(initCode));
    if (await ethers.provider.getCode(predicted) === "0x") {
      await (await deployer.sendTransaction({ to: CREATE2_PROXY, data: ethers.concat([FACTORY_SALT, initCode]) })).wait();
    }
    const factory = (await ethers.getContractAt("AktionariatFactory", predicted)).connect(deployer) as unknown as Contract;
    for (const [setter, store] of [["setSharesFactory", "SharesFactory"], ["setSharesUnderAgreementFactory", "SharesUnderAgreementFactory"], ["setLockReleaseTokenPoolFactory", "LockReleaseTokenPoolFactory"]]) {
      const s = await (await ethers.getContractFactory(store)).deploy();
      await factory[setter](s);
    }
    await factory.setChainlink(CHAINLINK_MAINNET);
    const c = await factory.deployCompany.staticCall({ ticker: "BRX", name: "Bridge Co", terms: "https://brx.test/terms", wrapperTerms: "https://brx.test/sha", restricted: true, owner: owner.address });
    await factory.deployCompany({ ticker: "BRX", name: "Bridge Co", terms: "https://brx.test/terms", wrapperTerms: "https://brx.test/sha", restricted: true, owner: owner.address });

    const w = await ethers.getContractAt("SharesUnderAgreement", c.wrapper);
    const s = await ethers.getContractAt("Shares", c.base);
    const p = new ethers.Contract(c.pool, POOL_ABI, owner);
    const l = new ethers.Contract(c.lockBox, LOCKBOX_ABI, owner);
    // the issuer accepts the pool and enables the remote chain, as the portal proposals would
    await p.acceptOwnership();
    await l.acceptOwnership();
    await p.applyChainUpdates([], [chainUpdate(coder, POLYGON_SELECTOR, REMOTE_POOL, c.wrapper)]);

    const router = new ethers.Contract(CHAINLINK_MAINNET.router, ROUTER_ABI, ethers.provider);
    const onRampAddress = await router.getOnRamp(POLYGON_SELECTOR);
    const offRampAddress = (await router.getOffRamps()).filter((o: any) => o.sourceChainSelector === POLYGON_SELECTOR).at(-1).offRamp;
    for (const a of [onRampAddress, offRampAddress]) {
      await connection.networkHelpers.impersonateAccount(a);
      await connection.networkHelpers.setBalance(a, ethers.parseEther("1"));
    }
    await mintAndWrap(s, w, signer1.address, 100n);
    return { wrapper: w as unknown as Contract, shares: s as unknown as Contract, pool: p, lockBox: l, onRamp: await ethers.getSigner(onRampAddress), offRamp: await ethers.getSigner(offRampAddress) };
  }

  beforeEach(async () => {
    ({ wrapper, shares, pool, lockBox, onRamp, offRamp } = await connection.networkHelpers.loadFixture(setup));
  });

  function lockOrBurn(holder: string, amount: bigint) {
    return pool.connect(onRamp).lockOrBurn({ receiver: coder.encode(["address"], [holder]), remoteChainSelector: POLYGON_SELECTOR, originalSender: holder, amount, localToken: wrapper.target });
  }

  function releaseOrMint(receiver: string, amount: bigint) {
    return pool.connect(offRamp).releaseOrMint({ originalSender: coder.encode(["address"], [receiver]), remoteChainSelector: POLYGON_SELECTOR, receiver, sourceDenominatedAmount: amount, localToken: wrapper.target, sourcePoolAddress: coder.encode(["address"], [REMOTE_POOL]), sourcePoolData: "0x", offchainTokenData: "0x" });
  }

  it("locks an allowed holder's tokens in the lockbox", async () => {
    // the router moves the tokens to the pool first, then the on-ramp calls the pool
    await wrapper.connect(signer1).transfer(pool.target, 10n);
    await lockOrBurn(signer1.address, 10n);
    expect(await wrapper.balanceOf(lockBox.target)).to.equal(10n);
    expect(await wrapper.balanceOf(pool.target)).to.equal(0n);
    expect(await wrapper.balanceOf(signer1)).to.equal(90n);
  });

  it("refuses a frozen holder before the pool is even reached", async () => {
    await wrapper.connect(owner).freeze(signer1);
    await expect(wrapper.connect(signer1).transfer(pool.target, 10n)).to.be.revertedWithCustomError(wrapper, "Allowlist_SenderIsForbidden").withArgs(signer1.address);
  });

  it("refuses the pool call from anyone but the on-ramp", async () => {
    await wrapper.connect(signer1).transfer(pool.target, 10n);
    await expect(pool.connect(signer1).lockOrBurn({ receiver: coder.encode(["address"], [signer1.address]), remoteChainSelector: POLYGON_SELECTOR, originalSender: signer1.address, amount: 10n, localToken: wrapper.target }))
      .to.be.revertedWithCustomError(pool, "CallerIsNotARampOnRouter").withArgs(signer1.address);
  });

  describe("bridging back", function () {
    beforeEach(async () => {
      await wrapper.connect(signer1).transfer(pool.target, 10n);
      await lockOrBurn(signer1.address, 10n);
    });

    it("releases to an allowed receiver only", async () => {
      // an unlisted receiver waits until the issuer types it; the message can be executed afterwards
      await expect(releaseOrMint(signer3.address, 4n)).to.be.revertedWithCustomError(wrapper, "Allowlist_ReceiverNotAllowlisted").withArgs(signer3.address);
      await wrapper.connect(owner)["setType(address,uint8)"](signer3, TYPE_ALLOWED);
      await releaseOrMint(signer3.address, 4n);
      expect(await wrapper.balanceOf(signer3)).to.equal(4n);
      expect(await wrapper.balanceOf(lockBox.target)).to.equal(6n);
    });

    it("does not release to a frozen receiver", async () => {
      await wrapper.connect(owner).freeze(signer2);
      await expect(releaseOrMint(signer2.address, 4n)).to.be.revertedWithCustomError(wrapper, "Allowlist_ReceiverIsForbidden").withArgs(signer2.address);
    });

    it("rejects a message from an unknown source pool", async () => {
      await expect(pool.connect(offRamp).releaseOrMint({ originalSender: coder.encode(["address"], [signer1.address]), remoteChainSelector: POLYGON_SELECTOR, receiver: signer1.address, sourceDenominatedAmount: 4n, localToken: wrapper.target, sourcePoolAddress: coder.encode(["address"], [signer2.address]), sourcePoolData: "0x", offchainTokenData: "0x" }))
        .to.be.revertedWithCustomError(pool, "InvalidSourcePoolAddress");
    });

    it("lets the issuer recover the custody address like any other, and cancel it", async () => {
      // M4: a recovery claim against the lockbox is the whole bridged float; the owner can cancel it
      await wrapper.connect(signer2)["initRecovery(address)"](lockBox.target, { value: await wrapper.deterrenceFee() });
      await wrapper.connect(owner)["cancelRecovery(address)"](lockBox.target);
      expect((await wrapper.recoveries(lockBox.target)).timestamp).to.equal(0n);
    });
  });
});
