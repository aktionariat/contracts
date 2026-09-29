import { expect } from "chai";
import { Contract } from "ethers";
import hre from "hardhat";
import { connection, deployer, ethers, owner, signer1 } from "./TestBase.ts";
import { UNISWAP_QUOTER_V2, UNISWAP_UNIVERSAL_ROUTER, ZCHF_ADDRESS } from "./Fixtures.ts";

// Tests for contracts/factories/*: AktionariatFactory deploys a company through CREATE3 from bytecode
// stores, so every address is a function of the factory address and the ticker only. The factory itself is
// deployed through the public deterministic deployment proxy, which puts it on the same address on the
// polygon fork, where the bridged wrapper then lands on the home-chain wrapper's address.

const CREATE2_PROXY = "0x4e59b44847b379578588920ca78fbf26c0b4956c";
const FACTORY_SALT = ethers.id("AktionariatFactory test");

const TYPE_FREE = 0n, TYPE_ALLOWED = 1n, TYPE_ADMIN = 4n;

function companyParams(ticker: string, overrides: Partial<Record<string, any>> = {}) {
  return {
    ticker,
    name: `${ticker} Company Shares`,
    terms: `https://${ticker.toLowerCase()}.test/terms`,
    wrapperTerms: `https://${ticker.toLowerCase()}.test/agreement`,
    restricted: false,
    owner: owner.address,
    ...overrides,
  };
}
const DI = { price: ethers.parseUnits("10", 18), increment: ethers.parseUnits("0.01", 18) };

// Deploys the factory through the deterministic proxy so its address only depends on the salt and the deployer argument.
async function deployFactoryViaProxy(eth: any, signer: any): Promise<Contract> {
  const Factory = await eth.getContractFactory("AktionariatFactory");
  const initCode = ethers.concat([Factory.bytecode, ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signer.address])]);
  const predicted = ethers.getCreate2Address(CREATE2_PROXY, FACTORY_SALT, ethers.keccak256(initCode));
  if (await eth.provider.getCode(predicted) === "0x") {
    await (await signer.sendTransaction({ to: CREATE2_PROXY, data: ethers.concat([FACTORY_SALT, initCode]) })).wait();
    expect(await eth.provider.getCode(predicted)).to.not.equal("0x");
  }
  return (await eth.getContractAt("AktionariatFactory", predicted)).connect(signer) as unknown as Contract;
}

async function deployStore(eth: any, name: string): Promise<Contract> {
  const store = await (await eth.getContractFactory(name)).deploy();
  await store.waitForDeployment();
  return store as unknown as Contract;
}

describe("AktionariatFactory", function () {
  let factory: Contract;
  let paymentHub: Contract;
  let stores: Record<string, Contract>;

  async function setup() {
    const f = await deployFactoryViaProxy(ethers, deployer);
    const s: Record<string, Contract> = {};
    for (const name of ["SharesFactory", "SharesUnderAgreementFactory", "DirectInvestmentFactory", "SecondaryMarketFactory"]) {
      s[name] = await deployStore(ethers, name);
    }
    await f.setSharesFactory(s.SharesFactory);
    await f.setSharesUnderAgreementFactory(s.SharesUnderAgreementFactory);
    await f.setDirectInvestmentFactory(s.DirectInvestmentFactory);
    await f.setSecondaryMarketFactory(s.SecondaryMarketFactory);
    const PaymentHub = await ethers.getContractFactory("contracts/investment/PaymentHub.sol:PaymentHub");
    const hub = await PaymentHub.deploy(owner, UNISWAP_QUOTER_V2, UNISWAP_UNIVERSAL_ROUTER);
    await hub.waitForDeployment();
    await f.setPaymentHub(hub);
    await f.setRouter(signer1);
    await f.setCurrency(ZCHF_ADDRESS);
    return { factory: f, paymentHub: hub as unknown as Contract, stores: s };
  }

  beforeEach(async () => {
    ({ factory, paymentHub, stores } = await connection.networkHelpers.loadFixture(setup));
  });

  async function deployed(tx: any) {
    const receipt = await (await tx).wait();
    return receipt;
  }

  it("deploys base and wrapper on the predicted addresses, owned by the issuer", async () => {
    const p = companyParams("ABC");
    const predicted = await factory.predictCompany("ABC");
    await expect(factory.deployCompany(p)).to.emit(factory, "CompanyDeployed").withArgs("ABC", owner.address, predicted.base, predicted.wrapper);
    const base = await ethers.getContractAt("Shares", predicted.base);
    const wrapper = await ethers.getContractAt("SharesUnderAgreement", predicted.wrapper);
    expect(await base.symbol()).to.equal("ABC");
    expect(await base.name()).to.equal(p.name);
    expect(await base.terms()).to.equal(p.terms);
    expect(await base.owner()).to.equal(owner.address);
    expect(await wrapper.base()).to.equal(predicted.base);
    expect(await wrapper.symbol()).to.equal("ABCS");
    expect(await wrapper.terms()).to.equal(p.wrapperTerms);
    expect(await wrapper.owner()).to.equal(owner.address);
    // nothing deployed on the optional slots
    expect(await ethers.provider.getCode(predicted.directInvestment)).to.equal("0x");
    expect(await ethers.provider.getCode(predicted.market)).to.equal("0x");
  });

  it("leaves a free company untyped", async () => {
    const c = await factory.deployCompany.staticCall(companyParams("FREE"));
    await factory.deployCompany(companyParams("FREE"));
    const base = await ethers.getContractAt("Shares", c.base);
    const wrapper = await ethers.getContractAt("SharesUnderAgreement", c.wrapper);
    expect(await base.defaultType()).to.equal(TYPE_FREE);
    expect(await wrapper.defaultType()).to.equal(TYPE_FREE);
    expect(await base.isAdmin(c.wrapper)).to.equal(false);
    expect(await base.isAllowed(c.wrapper)).to.equal(false);
  });

  it("applies the restricted regime: wrapper ADMIN on the base, market and DI ALLOWED on the wrapper", async () => {
    const p = companyParams("RST", { restricted: true });
    const c = await factory.deployCompanyWithDirectInvestmentAndSecondaryMarket.staticCall(p, DI);
    await factory.deployCompanyWithDirectInvestmentAndSecondaryMarket(p, DI);
    const base = await ethers.getContractAt("Shares", c.base);
    const wrapper = await ethers.getContractAt("SharesUnderAgreement", c.wrapper);
    expect(await base.defaultType()).to.equal(TYPE_ALLOWED);
    expect(await wrapper.defaultType()).to.equal(TYPE_ALLOWED);
    expect(await base.isAdmin(c.wrapper)).to.equal(true);
    expect(await wrapper.isAllowed(c.directInvestment)).to.equal(true);
    expect(await wrapper.isAdmin(c.directInvestment)).to.equal(false);
    expect(await wrapper.isAllowed(c.market)).to.equal(true);
    expect(await wrapper.isAdmin(c.market)).to.equal(false);
    // the factory kept nothing
    expect(await base.owner()).to.equal(owner.address);
    expect(await wrapper.owner()).to.equal(owner.address);
  });

  it("deploys DirectInvestment and SecondaryMarket against the wrapper with the factory settings", async () => {
    const predicted = await factory.predictCompany("DIM");
    const tx = factory.deployCompanyWithDirectInvestmentAndSecondaryMarket(companyParams("DIM"), DI);
    await expect(tx).to.emit(factory, "DirectInvestmentDeployed").withArgs(predicted.wrapper, predicted.directInvestment);
    await expect(tx).to.emit(factory, "SecondaryMarketDeployed").withArgs(predicted.wrapper, predicted.market);
    const di = await ethers.getContractAt("DirectInvestment", predicted.directInvestment);
    expect(await di.token()).to.equal(predicted.wrapper);
    expect(await di.base()).to.equal(ZCHF_ADDRESS);
    expect(await di.price()).to.equal(DI.price);
    expect(await di.increment()).to.equal(DI.increment);
    expect(await di.owner()).to.equal(owner.address);
    expect(await di.paymenthub()).to.equal(await paymentHub.getAddress());
    const market = await ethers.getContractAt("SecondaryMarket", predicted.market);
    expect(await market.TOKEN()).to.equal(predicted.wrapper);
    expect(await market.CURRENCY()).to.equal(ZCHF_ADDRESS);
    expect(await market.router()).to.equal(signer1.address);
    expect(await market.owner()).to.equal(owner.address);
  });

  it("deploys with DirectInvestment only", async () => {
    const predicted = await factory.predictCompany("DIO");
    await expect(factory.deployCompanyWithDirectInvestment(companyParams("DIO"), DI)).to.emit(factory, "DirectInvestmentDeployed").withArgs(predicted.wrapper, predicted.directInvestment);
    expect(await ethers.provider.getCode(predicted.market)).to.equal("0x");
  });

  it("adds a market and a second DirectInvestment to an existing company, owned by the current token owner", async () => {
    const predicted = await factory.predictCompany("ADD");
    await factory.deployCompanyWithDirectInvestment(companyParams("ADD", { restricted: true }), DI);
    const wrapper = await ethers.getContractAt("SharesUnderAgreement", predicted.wrapper);
    await wrapper.connect(owner).transferOwnership(signer1);

    await expect(factory.addSecondaryMarket("ADD")).to.emit(factory, "SecondaryMarketDeployed").withArgs(predicted.wrapper, predicted.market);
    const market = await ethers.getContractAt("SecondaryMarket", predicted.market);
    expect(await market.owner()).to.equal(signer1.address);
    // the factory no longer owns the wrapper, so the issuer types the market
    expect(await wrapper.isAllowed(predicted.market)).to.equal(false);

    const secondDI = await factory.predictDirectInvestment("ADD", 1);
    expect(secondDI).to.not.equal(predicted.directInvestment);
    await expect(factory.addDirectInvestment("ADD", DI, 1)).to.emit(factory, "DirectInvestmentDeployed").withArgs(predicted.wrapper, secondDI);
    expect(await (await ethers.getContractAt("DirectInvestment", secondDI)).owner()).to.equal(signer1.address);
    await expect(factory.addDirectInvestment("ADD", DI, 0)).to.be.revertedWithCustomError(factory, "Create3_SaltAlreadyUsed");
  });

  it("refuses to add to a company that does not exist", async () => {
    await expect(factory.addSecondaryMarket("NONE")).to.revert(ethers);
  });

  it("rejects a reused ticker, a zero owner, a stranger, and an unset store", async () => {
    await factory.deployCompany(companyParams("DUP"));
    await expect(factory.deployCompany(companyParams("DUP"))).to.be.revertedWithCustomError(factory, "Create3_SaltAlreadyUsed");
    await expect(factory.deployCompany(companyParams("ZERO", { owner: ethers.ZeroAddress }))).to.be.revertedWithCustomError(factory, "OwnerRequired");
    await expect(factory.connect(signer1).deployCompany(companyParams("STRANGER"))).to.be.revertedWithCustomError(factory, "Ownable_NotOwner");
    await factory.setSharesUnderAgreementFactory(ethers.ZeroAddress);
    await expect(factory.deployCompany(companyParams("NOSTORE"))).to.be.revertedWithCustomError(factory, "StoreNotSet").withArgs("sharesUnderAgreementFactory");
  });

  it("reports the versions of the deployed contracts", async () => {
    const v = await factory.versions();
    const c = await factory.deployCompanyWithDirectInvestmentAndSecondaryMarket.staticCall(companyParams("VER"), DI);
    await factory.deployCompanyWithDirectInvestmentAndSecondaryMarket(companyParams("VER"), DI);
    expect(v.factory).to.equal(await factory.VERSION());
    expect(v.shares).to.equal(await (await ethers.getContractAt("Shares", c.base)).VERSION());
    expect(v.sharesUnderAgreement).to.equal(await (await ethers.getContractAt("SharesUnderAgreement", c.wrapper)).VERSION());
    expect(v.directInvestment).to.equal(await (await ethers.getContractAt("DirectInvestment", c.directInvestment)).VERSION());
    expect(v.secondaryMarket).to.equal(await (await ethers.getContractAt("SecondaryMarket", c.market)).VERSION());
    expect(v.bridgedSharesUnderAgreement).to.equal(0n); // store not set
  });

  it("settings are owner-only and emit", async () => {
    await expect(factory.setCurrency(signer1)).to.emit(factory, "SettingChanged").withArgs("currency", signer1.address);
    expect(await factory.currency()).to.equal(signer1.address);
    await expect(factory.connect(signer1).setCurrency(signer1)).to.be.revertedWithCustomError(factory, "Ownable_NotOwner");
  });

  it("refuses the bridged token on the home chain", async () => {
    await expect(factory.deployBridgedToken("ABC", "ABCS", "ABC Company Shares SHA", "https://abc.test/agreement", false, owner)).to.be.revertedWithCustomError(factory, "HomeChain");
  });
});

describe("AktionariatFactory on another chain (polygon fork)", function () {
  let l2Ethers: any;
  let l2Deployer: any;
  let l2Factory: Contract;
  let homeFactory: Contract;

  before(async function () {
    const l2 = await hre.network.connect("hardhatPolygon");
    l2Ethers = l2.ethers;
    [l2Deployer] = await l2Ethers.getSigners();
    l2Factory = await deployFactoryViaProxy(l2Ethers, l2Deployer);
    homeFactory = await deployFactoryViaProxy(ethers, deployer);
  });

  it("sits on the same address as on the home chain", async () => {
    expect(await l2Factory.getAddress()).to.equal(await homeFactory.getAddress());
  });

  it("refuses company deployment off the home chain", async () => {
    await expect(l2Factory.deployCompany(companyParams("ABC"))).to.be.revertedWithCustomError(l2Factory, "NotHomeChain");
  });

  it("puts the bridged wrapper on the home-chain wrapper's address", async () => {
    // Stand-in store: Shares has the same constructor shape (symbol, name, terms, owner) as the bridged token.
    await l2Factory.setBridgedSharesUnderAgreementFactory(await deployStore(l2Ethers, "SharesFactory"));
    const home = await homeFactory.predictCompany("ABC");
    const tx = l2Factory.deployBridgedToken("ABC", "ABCS", "ABC Company Shares SHA", "https://abc.test/agreement", true, owner.address);
    await expect(tx).to.emit(l2Factory, "BridgedTokenDeployed").withArgs("ABC", owner.address, home.wrapper);
    const token = await l2Ethers.getContractAt("Shares", home.wrapper);
    expect(await token.symbol()).to.equal("ABCS");
    expect(await token.owner()).to.equal(owner.address);
    expect(await token.defaultType()).to.equal(TYPE_ALLOWED);
  });
});
