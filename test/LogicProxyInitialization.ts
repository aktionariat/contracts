import { expect } from "chai";
import { ethers, owner } from "./TestBase.ts";

// Verify that _disableInitializers() disables initializers.

const TERMS = "https://test.com/terms";
const AGREEMENT_TERMS = "https://test.com/agreement";
const BSHA_SYMBOL = "BSHA";
const BSHA_NAME = "Bridged SHA";

describe("LogicProxyInitialization", function () {
  it("Shares: initialize reverts after constructor deployment", async function () {
    const Shares = await ethers.getContractFactory("Shares");
    const shares = await Shares.deploy("TEST", "Test Shares", TERMS, owner);
    await shares.waitForDeployment();

    await expect(
      shares.initialize("TEST2", "Test Shares 2", TERMS, owner)
    ).to.be.revertedWithCustomError(shares, "InvalidInitialization");
  });

  it("SharesUnderAgreement: initialize reverts after constructor deployment", async function () {
    // SHA needs a base Shares token
    const Shares = await ethers.getContractFactory("Shares");
    const base = await Shares.deploy("BASE", "Base Shares", TERMS, owner);
    await base.waitForDeployment();

    const SHA = await ethers.getContractFactory("SharesUnderAgreement");
    const sha = await SHA.deploy(
      await base.getAddress(),
      AGREEMENT_TERMS,
      0,
      owner
    );
    await sha.waitForDeployment();

    await expect(
      sha.initialize(await base.getAddress(), "other terms", 0, owner)
    ).to.be.revertedWithCustomError(sha, "InvalidInitialization");
  });

  it("BridgedSharesUnderAgreement: initialize reverts after constructor deployment", async function () {
    const BSHA = await ethers.getContractFactory("BridgedSharesUnderAgreement");
    const bsha = await BSHA.deploy(BSHA_SYMBOL, BSHA_NAME, TERMS, owner);
    await bsha.waitForDeployment();

    await expect(
      bsha.initialize("OTHER", "Other Name", TERMS, owner)
    ).to.be.revertedWithCustomError(bsha, "InvalidInitialization");
  });

  it("LockReleaseTokenPoolProxy: initialize reverts after constructor deployment", async function () {
    // Deploy dependencies
    const MockRMN = await ethers.getContractFactory(
      "contracts/mocks/MockRMN.sol:MockRMN"
    );
    const rmn = await MockRMN.deploy();
    await rmn.waitForDeployment();

    const MockRouter = await ethers.getContractFactory(
      "contracts/mocks/MockCCIPRouter.sol:MockCCIPRouter"
    );
    const router = await MockRouter.deploy();
    await router.waitForDeployment();

    // Use Shares as the dummy bridged token
    const Shares = await ethers.getContractFactory("Shares");
    const token = await Shares.deploy("POOL", "Pool Token", TERMS, owner);
    await token.waitForDeployment();

    const Pool = await ethers.getContractFactory("LockReleaseTokenPoolProxy");
    const pool = await Pool.deploy(
      await token.getAddress(),
      0,
      [],
      await rmn.getAddress(),
      true,
      await router.getAddress()
    );
    await pool.waitForDeployment();

    await expect(
      pool.initialize(
        await token.getAddress(),
        0,
        [],
        await rmn.getAddress(),
        true,
        await router.getAddress()
      )
    ).to.be.revertedWithCustomError(pool, "InvalidInitialization");
  });

  it("BurnMintTokenPoolProxy: initialize reverts after constructor deployment", async function () {
    // Deploy dependencies
    const MockRMN = await ethers.getContractFactory(
      "contracts/mocks/MockRMN.sol:MockRMN"
    );
    const rmn = await MockRMN.deploy();
    await rmn.waitForDeployment();

    const MockRouter = await ethers.getContractFactory(
      "contracts/mocks/MockCCIPRouter.sol:MockCCIPRouter"
    );
    const router = await MockRouter.deploy();
    await router.waitForDeployment();

    // Use BSHA as dummy bridge token
    const BSHA = await ethers.getContractFactory("BridgedSharesUnderAgreement");
    const token = await BSHA.deploy("BMINT", "Burn Mint Token", TERMS, owner);
    await token.waitForDeployment();

    const Pool = await ethers.getContractFactory("BurnMintTokenPoolProxy");
    const pool = await Pool.deploy(
      await token.getAddress(),
      0,
      [],
      await rmn.getAddress(),
      await router.getAddress()
    );
    await pool.waitForDeployment();

    await expect(
      pool.initialize(
        await token.getAddress(),
        0,
        [],
        await rmn.getAddress(),
        await router.getAddress()
      )
    ).to.be.revertedWithCustomError(pool, "InvalidInitialization");
  });
});
