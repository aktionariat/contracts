import { expect } from "chai";
import {
  ethers,
  connection,
  provider,
  owner,
  signer1,
  signer2,
  signer3,
} from "./TestBase.ts";
import { setBalance } from "../scripts/helpers/setBalance.ts";
import {
  deployBridgeFixture,
  lockSourceAndMintDest,
  burnDestAndReleaseSource,
  ONRAMP_ADDRESS,
  type BridgeFixture,
} from "./FactoryFixture.ts";

const MIGRATION_DELAY = 20n * 24n * 60n * 60n; // 20 days
const DRAG_DELAY = 20n * 24n * 60n * 60n; // 20 days

describe("Token Bridge Events tests", function () {
  let f: BridgeFixture;

  beforeEach(async () => {
    f = await connection.networkHelpers.loadFixture(deployBridgeFixture);
  });

  it("bridges BSHA to destination, executes drag-along, bridges BSHA back and unwraps to payment currency", async () => {
    const signer1Addr = await signer1.getAddress();
    const signer2Addr = await signer2.getAddress();
    const signer3Addr = await signer3.getAddress();
    const amount = 100n;

    // Bridge 100 SHA to BSHA
    await f.sha
      .connect(signer1)
      .approve(await f.lockReleasePool.getAddress(), amount);
    await f.sha
      .connect(signer1)
      .transfer(await f.lockReleasePool.getAddress(), amount);
    await lockSourceAndMintDest(f, signer1Addr, signer2Addr, amount);
    expect(await f.bsha.balanceOf(signer2Addr)).to.equal(amount);

    // Verify lockOrBurn reverts when halted
    // remember that we impersonate onRamp since only onRamp can call, as mock router
    // returns address(12345678)
    await provider.request({
      method: "hardhat_impersonateAccount",
      params: [ONRAMP_ADDRESS],
    });
    await setBalance(ONRAMP_ADDRESS, ethers.parseEther("100"));
    const onRamp = await ethers.getSigner(ONRAMP_ADDRESS);

    await provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [ONRAMP_ADDRESS],
    });

    // Deploy MockERC20 as payment currency and fund buyer
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const currency = await MockERC20.deploy("Mock CHF", "MCHF");
    await currency.waitForDeployment();

    // We set offer at 10 MCHF per SHA in E18
    const pricePerShare = ethers.parseEther("10");
    const totalPrice =
      (pricePerShare * (await f.sha.totalSupply())) / 10n ** 18n;
    await currency.connect(signer3).mint(signer3Addr, totalPrice);
    await currency
      .connect(signer3)
      .approve(await f.sha.getAddress(), totalPrice);

    // Make drag-along offer, wait, accept
    await f.sha
      .connect(signer3)
      .offerAcquisition(currency, pricePerShare, "Acquisition offer", {
        value: ethers.parseEther("1"),
      });
    await connection.networkHelpers.time.increase(DRAG_DELAY + 1n);
    await f.sha.acceptOffer();

    expect(await f.sha.binding()).to.equal(false);
    expect(await f.sha.base()).to.equal(await currency.getAddress());

    // Bridge BSHA back
    await f.bsha
      .connect(signer2)
      .approve(await f.burnMintPool.getAddress(), amount);
    await f.bsha
      .connect(signer2)
      .transfer(await f.burnMintPool.getAddress(), amount);
    await burnDestAndReleaseSource(f, signer2Addr, signer1Addr, amount);
    expect(await f.bsha.balanceOf(signer2Addr)).to.equal(0n);

    // Unwrap SHA and get MCHF
    //  signer1 should have 200 SHA: 100 remaining from original mint and 100 released from bridge back
    const shaBalance = await f.sha.balanceOf(signer1Addr);
    expect(shaBalance).to.equal(200n);

    const currencyBefore = await currency.balanceOf(signer1Addr);
    await f.sha.connect(signer1).unwrap(shaBalance);
    const currencyAfter = await currency.balanceOf(signer1Addr);

    expect(currencyAfter - currencyBefore).to.be.greaterThan(0n);
    expect(await f.sha.balanceOf(signer1Addr)).to.equal(0n);
  });

  it("proposes migration, bridges back, executes migration to successor", async () => {
    const signer1Addr = await signer1.getAddress();
    const signer2Addr = await signer2.getAddress();
    const amount = 100n;

    // Bridge 100 SHA to BSHA
    await f.sha
      .connect(signer1)
      .approve(await f.lockReleasePool.getAddress(), amount);
    await f.sha
      .connect(signer1)
      .transfer(await f.lockReleasePool.getAddress(), amount);
    await lockSourceAndMintDest(f, signer1Addr, signer2Addr, amount);
    expect(await f.bsha.balanceOf(signer2Addr)).to.equal(amount);

    // Deploy MockSuccessor as the migration target
    const MockSuccessor = await ethers.getContractFactory("MockSuccessor");
    const successor = await MockSuccessor.deploy("Successor Token", "SUC");
    await successor.waitForDeployment();

    // Propose migration to successor
    await f.sha.connect(owner).proposeMigration(await successor.getAddress());

    // Wait for migration delay
    await connection.networkHelpers.time.increase(MIGRATION_DELAY + 1n);

    // Bridge BSHA back
    await f.bsha
      .connect(signer2)
      .approve(await f.burnMintPool.getAddress(), amount);
    await f.bsha
      .connect(signer2)
      .transfer(await f.burnMintPool.getAddress(), amount);
    await burnDestAndReleaseSource(f, signer2Addr, signer1Addr, amount);
    expect(await f.bsha.balanceOf(signer2Addr)).to.equal(0n);

    // Execute migration: SHA now wraps successor instead of base shares
    await f.sha.executeMigration();
    expect(await f.sha.binding()).to.equal(false);
    expect(await f.sha.base()).to.equal(await successor.getAddress());

    // Verify SHA still has tokens: 100 remaining and 100 released from bridge back
    const shaBalance = await f.sha.balanceOf(signer1Addr);
    expect(shaBalance).to.equal(200n);
  });

  it("proposes cancellation, bridges back, cancels and unwraps", async () => {
    const signer1Addr = await signer1.getAddress();
    const signer2Addr = await signer2.getAddress();
    const amount = 100n;

    // Bridge 100 SHA to BSHA
    await f.sha
      .connect(signer1)
      .approve(await f.lockReleasePool.getAddress(), amount);
    await f.sha
      .connect(signer1)
      .transfer(await f.lockReleasePool.getAddress(), amount);
    await lockSourceAndMintDest(f, signer1Addr, signer2Addr, amount);
    expect(await f.bsha.balanceOf(signer2Addr)).to.equal(amount);

    // Owner proposes cancellation
    await f.sha.connect(owner).proposeCancellation();

    // Wait for migration delay
    await connection.networkHelpers.time.increase(MIGRATION_DELAY + 1n);

    // Bridge BSHA back
    await f.bsha
      .connect(signer2)
      .approve(await f.burnMintPool.getAddress(), amount);
    await f.bsha
      .connect(signer2)
      .transfer(await f.burnMintPool.getAddress(), amount);
    await burnDestAndReleaseSource(f, signer2Addr, signer1Addr, amount);
    expect(await f.bsha.balanceOf(signer2Addr)).to.equal(0n);

    // Execute cancellation — burns SHA's base, terminates
    await f.sha.executeMigration();
    expect(await f.sha.binding()).to.equal(false);

    // Unwrap SHA
    const shaBalance = await f.sha.balanceOf(signer1Addr);
    // 100 remaining and 100 released from bridge back
    expect(shaBalance).to.equal(200n);

    await f.sha.connect(signer1).unwrap(shaBalance);
    expect(await f.sha.balanceOf(signer1Addr)).to.equal(0n);
  });
});
