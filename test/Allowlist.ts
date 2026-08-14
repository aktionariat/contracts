import { expect } from "chai";
import { Contract } from "ethers";
import {
  connection,
  ethers,
  owner,
  signer1,
  signer2,
  signer3,
} from "./TestBase.ts";

// Allowlist tests for addresses policies
// To be tested the always-free allowlist of the zero address and contracts.
// Which implies that minting and third party transfers to contracts do not
// modify the capability of transfering tokens between involved, free and allowed
// addresses

const SHARES = {
  symbol: "TEST",
  name: "Test Company Shares",
  terms: "https://test.com/terms",
};
const SHA_TERMS = "https://test.com/agreement";
const DECIMALS = 0;

// 184 days
const RECOVERY_DELAY = 184n * 24n * 60n * 60n;

async function deployShares(): Promise<Contract> {
  const Shares = await ethers.getContractFactory(
    "contracts/shares/base/Shares.sol:Shares"
  );
  const s = await Shares.deploy(
    SHARES.symbol,
    SHARES.name,
    SHARES.terms,
    owner
  );
  await s.waitForDeployment();
  return s as unknown as Contract;
}

async function deploySharesUnderAgreement(base: Contract): Promise<Contract> {
  const SUA = await ethers.getContractFactory(
    "contracts/shares/sha/SharesUnderAgreement.sol:SharesUnderAgreement"
  );
  const sua = await SUA.deploy(base, SHA_TERMS, DECIMALS, owner);
  await sua.waitForDeployment();
  return sua as unknown as Contract;
}

describe("Allowlist (ERC20Allowlistable)", function () {
  it("keeps address zero free and new mints in the free tier after an admin burns", async () => {
    const shares = await deployShares();
    const sha = await deploySharesUnderAgreement(shares);

    // Mint base shares and wrap them into SHA for signer1 in one owner call.
    await shares.connect(owner).mintAndWrap(signer1, sha, 100n);
    expect(await sha.balanceOf(signer1)).to.equal(100n);

    // Address zero is the "free" allowance sentinel before any burn.
    expect(await sha.isAllowed(ethers.ZeroAddress)).to.equal(false);
    expect(await sha.isAdmin(ethers.ZeroAddress)).to.equal(false);
    expect(await sha.isRestricted(ethers.ZeroAddress)).to.equal(false);
    expect(await sha.defaultType()).to.equal(await sha.TYPE_FREE());

    // Promote the SHA holder to admin.
    await sha
      .connect(owner)
      ["setType(address,uint8)"](signer1, await sha.TYPE_ADMIN());
    expect(await sha.isAdmin(signer1)).to.equal(true);

    // Burn part of the admin holder's SHA balance.
    await sha.connect(owner).initBurn(signer1);
    await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
    await sha.connect(owner)["burn(address,uint256)"](signer1, 40n);
    expect(await sha.balanceOf(signer1)).to.equal(60n);

    // Address zero must still be a "free" allowance address after the burn.
    expect(await sha.isAllowed(ethers.ZeroAddress)).to.equal(false);
    expect(await sha.isAdmin(ethers.ZeroAddress)).to.equal(false);
    expect(await sha.isRestricted(ethers.ZeroAddress)).to.equal(false);
    expect(await sha.defaultType()).to.equal(await sha.TYPE_FREE());

    // New shares can still be minted and wrapped to a fresh signer, who lands in
    // the "free" tier (not auto-allowlisted).
    await shares.connect(owner).mintAndWrap(signer2, sha, 25n);
    expect(await sha.balanceOf(signer2)).to.equal(25n);
    expect(await sha.isAllowed(signer2)).to.equal(false);
    expect(await sha.isAdmin(signer2)).to.equal(false);
    expect(await sha.isRestricted(signer2)).to.equal(false);

    // Extra check: admin transfer to any EOA does turn him into allowed
    await sha.connect(signer1).transfer(signer3, 10n);
    expect(await sha.isAllowed(signer3)).to.equal(true);
  });

  // Note that we use directly deployed addresses, skipping the proxy deployment
  // for simplicity
  it("does not auto-allowlist the LockReleaseTokenPool when an admin bridges via CCIP ccipSend", async () => {
    const shares = await deployShares();
    const sha = await deploySharesUnderAgreement(shares);

    // Mint and wrap to signer1, promote to admin.
    await shares.connect(owner).mintAndWrap(signer1, sha, 100n);
    await sha
      .connect(owner)
      ["setType(address,uint8)"](signer1, await sha.TYPE_ADMIN());
    expect(await sha.isAdmin(signer1)).to.equal(true);

    // Chainlink's canonical local CCIP simulator, which provides:
    // chain selector
    // mock Router
    // tokens: WETH9, LINK, CCIP-BnM/LnM.
    const CCIPLocalSimulator = await ethers.getContractFactory(
      "@chainlink/local/src/ccip/CCIPLocalSimulator.sol:CCIPLocalSimulator"
    );
    const simulator = await CCIPLocalSimulator.deploy();
    await simulator.waitForDeployment();

    const config = await simulator.configuration();
    const chainSelector = config[0];
    const mockRouterAddress = config[1];

    const mockRouter = await ethers.getContractAt(
      "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol:IRouterClient",
      mockRouterAddress
    );

    // We need to mock the pool's RMN proxy
    const MockRMN = await ethers.getContractFactory(
      "contracts/mocks/audit/agents/MockRMN.sol:MockRMN"
    );
    const rmn = await MockRMN.deploy();
    await rmn.waitForDeployment();

    // The LockReleaseTokenPool from our vendored implementation, connected to the
    // simulator's router.
    const LockReleaseTokenPoolProxy = await ethers.getContractFactory(
      "contracts/vendor/@chainlink/contracts-ccip/contracts/pools/LockReleaseTokenPoolProxy.sol:LockReleaseTokenPoolProxy"
    );
    const pool = await LockReleaseTokenPoolProxy.deploy(
      await sha.getAddress(),
      0,
      [],
      await rmn.getAddress(),
      false,
      mockRouterAddress
    );
    await pool.waitForDeployment();
    const poolAddress = await pool.getAddress();

    // signer1 (admin) approves token to be bridged: router moves them
    await sha.connect(signer1).approve(mockRouterAddress, 40n);

    const message = {
      receiver: ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"],
        [poolAddress]
      ),
      data: "0x",
      tokenAmounts: [{ token: await sha.getAddress(), amount: 40n }],
      feeToken: ethers.ZeroAddress,
      extraArgs: "0x",
    };

    await mockRouter.connect(signer1).ccipSend(chainSelector, message);

    // Pool locks tokens and is a "free" address
    expect(await sha.balanceOf(pool)).to.equal(40n);
    expect(await sha.isAllowed(pool)).to.equal(false);
    expect(await sha.isAdmin(pool)).to.equal(false);
    expect(await sha.isRestricted(pool)).to.equal(false);
  });
});
