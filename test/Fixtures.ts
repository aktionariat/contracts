import { Contract } from "ethers";
import { ethers, owner } from "./TestBase.ts";

// Shared deployment fixture for the new share-token stack.
//
// This intentionally lives under test/ (NOT ignition/) and deploys via plain ethers
// factories — it replaces the old `ignition/modules/TestModule.ts`, which was moved to a
// separate contracts-ignition repo. No mainnet fork is required to deploy these contracts;
// the forked ZCHF is only referenced for the market tests that price in CHF.

export const ZCHF_ADDRESS = "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB";

export const fixtureConfig = {
  shares: { symbol: "TEST", name: "Test Company Shares", terms: "https://test.com/terms" },
  sharesUnderAgreement: { terms: "https://test.com/agreement", decimals: 0 },
};

export interface Fixture {
  shares: Contract;                // base/Shares.sol — the registry token (replaces old Shares/AllowlistShares)
  sharesUnderAgreement: Contract;  // SharesUnderAgreement.sol — the wrapper (replaces old (Allowlist)DraggableShares)
  tradeReactor: Contract;
  secondaryMarketFactory: Contract;
  authorizedExecutor: Contract;
  zchf: Contract;                  // forked mainnet ZCHF, used as trading currency
}

async function deployShares(): Promise<Contract> {
  const Shares = await ethers.getContractFactory("contracts/shares/base/Shares.sol:Shares");
  const shares = await Shares.deploy(fixtureConfig.shares.symbol, fixtureConfig.shares.name, fixtureConfig.shares.terms, owner);
  await shares.waitForDeployment();
  return shares as unknown as Contract;
}

async function deploySharesUnderAgreement(base: Contract): Promise<Contract> {
  const SharesUnderAgreement = await ethers.getContractFactory("contracts/shares/sha/SharesUnderAgreement.sol:SharesUnderAgreement");
  const sharesUnderAgreement = await SharesUnderAgreement.deploy(base, fixtureConfig.sharesUnderAgreement.terms, fixtureConfig.sharesUnderAgreement.decimals, owner);
  await sharesUnderAgreement.waitForDeployment();
  return sharesUnderAgreement as unknown as Contract;
}

export async function deployFixture(): Promise<Fixture> {
  const shares = await deployShares();
  const sharesUnderAgreement = await deploySharesUnderAgreement(shares);

  const TradeReactor = await ethers.getContractFactory("TradeReactor");
  const tradeReactor = await TradeReactor.deploy();
  await tradeReactor.waitForDeployment();

  const SecondaryMarketFactory = await ethers.getContractFactory("SecondaryMarketFactory");
  const secondaryMarketFactory = await SecondaryMarketFactory.deploy();
  await secondaryMarketFactory.waitForDeployment();

  const AuthorizedExecutor = await ethers.getContractFactory("AuthorizedExecutor");
  const authorizedExecutor = await AuthorizedExecutor.deploy();
  await authorizedExecutor.waitForDeployment();

  const zchf = await ethers.getContractAt("contracts/ERC20/IERC20.sol:IERC20", ZCHF_ADDRESS);

  return {
    shares: shares as unknown as Contract,
    sharesUnderAgreement: sharesUnderAgreement as unknown as Contract,
    tradeReactor: tradeReactor as unknown as Contract,
    secondaryMarketFactory: secondaryMarketFactory as unknown as Contract,
    authorizedExecutor: authorizedExecutor as unknown as Contract,
    zchf,
  };
}

// New-stack equivalent of the old `scripts/helpers/mintAndWrap`: mints base shares to
// `holder` and wraps them 1:1 into the SharesUnderAgreement wrapper, in one owner call.
// (base/Shares.sol exposes mintAndWrap(shareholder, wrapper, amount).)
export async function mintAndWrap(shares: Contract, sharesUnderAgreement: Contract, holder: string, amount: bigint) {
  await shares.connect(owner).mintAndWrap(holder, sharesUnderAgreement, amount);
}
