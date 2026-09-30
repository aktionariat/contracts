import { expect } from "chai";
import { Contract } from "ethers";
import hre from "hardhat";
import { connection, deployer, ethers, owner, signer1 } from "./TestBase.ts";
import { UNISWAP_QUOTER_V2, UNISWAP_UNIVERSAL_ROUTER, ZCHF_ADDRESS } from "./Fixtures.ts";
import { CHAINLINK_MAINNET, CHAINLINK_POLYGON, LOCKBOX_ABI, MAINNET_SELECTOR, POOL_ABI, REGISTRY_ABI } from "./Chainlink.ts";

// Tests for contracts/factories/*: AktionariatFactory deploys a company through CREATE3 from bytecode
// stores, so every address is a function of the factory address and the ticker only. The factory itself is
// deployed through the public deterministic deployment proxy, which puts it on the same address on the
// polygon fork, where the bridged wrapper then lands on the home-chain wrapper's address. Chainlink's pools and
// lockbox are deployed from stores against the real CCIP infrastructure of the forks.

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
    for (const name of ["SharesFactory", "SharesUnderAgreementFactory", "DirectInvestmentFactory", "SecondaryMarketFactory", "LockReleaseTokenPoolFactory"]) {
      s[name] = await deployStore(ethers, name);
    }
    await f.setSharesFactory(s.SharesFactory);
    await f.setSharesUnderAgreementFactory(s.SharesUnderAgreementFactory);
    await f.setDirectInvestmentFactory(s.DirectInvestmentFactory);
    await f.setSecondaryMarketFactory(s.SecondaryMarketFactory);
    await f.setLockReleaseTokenPoolFactory(s.LockReleaseTokenPoolFactory);
    await f.setChainlink(CHAINLINK_MAINNET);
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

  it("deploys lockbox and pool for the wrapper, registers the pool and offers ownership to the issuer", async () => {
    const predicted = await factory.predictCompany("BRG");
    await expect(factory.deployCompany(companyParams("BRG"))).to.emit(factory, "BridgeDeployed").withArgs(predicted.wrapper, predicted.pool, predicted.lockBox);
    const pool = new ethers.Contract(predicted.pool, POOL_ABI, owner);
    const lockBox = new ethers.Contract(predicted.lockBox, LOCKBOX_ABI, owner);
    const registry = new ethers.Contract(CHAINLINK_MAINNET.tokenAdminRegistry, REGISTRY_ABI, ethers.provider);
    expect(await pool.typeAndVersion()).to.equal("LockReleaseTokenPool 2.0.0");
    expect(await pool.getToken()).to.equal(predicted.wrapper);
    expect((await pool.getDynamicConfig()).router).to.equal(ethers.getAddress(CHAINLINK_MAINNET.router));
    expect(await pool.getRmnProxy()).to.equal(ethers.getAddress(CHAINLINK_MAINNET.rmnProxy));
    expect(await lockBox.getToken()).to.equal(predicted.wrapper);
    expect(await lockBox.getAllAuthorizedCallers()).to.deep.equal([predicted.pool]);
    // the factory is the CCIP administrator, the pool is mapped
    const config = await registry.getTokenConfig(predicted.wrapper);
    expect(config.administrator).to.equal(await factory.getAddress());
    expect(config.tokenPool).to.equal(predicted.pool);
    // ownership is pending until the issuer accepts: two plain calls
    expect(await pool.owner()).to.equal(await factory.getAddress());
    await pool.acceptOwnership();
    await lockBox.acceptOwnership();
    expect(await pool.owner()).to.equal(owner.address);
    expect(await lockBox.owner()).to.equal(owner.address);
    // no remote chain yet
    expect(await pool.getRemotePools(MAINNET_SELECTOR)).to.deep.equal([]);
  });

  it("lets the factory remap the pool in the registry", async () => {
    const c = await factory.deployCompany.staticCall(companyParams("MAP"));
    await factory.deployCompany(companyParams("MAP"));
    const registry = new ethers.Contract(CHAINLINK_MAINNET.tokenAdminRegistry, REGISTRY_ABI, ethers.provider);
    await expect(factory.connect(signer1).setRegisteredPool(c.wrapper, ethers.ZeroAddress)).to.be.revertedWithCustomError(factory, "Ownable_NotOwner");
    await factory.setRegisteredPool(c.wrapper, ethers.ZeroAddress);
    expect(await registry.getPool(c.wrapper)).to.equal(ethers.ZeroAddress);
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

  it("applies the restricted regime: wrapper ADMIN on the base, market, DI, pool and lockbox ALLOWED on the wrapper", async () => {
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
    expect(await wrapper.isAllowed(c.pool)).to.equal(true);
    expect(await wrapper.isAllowed(c.lockBox)).to.equal(true);
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

  it("adds a market to an existing company, owned by the current token owner; a DirectInvestment of the same version is refused", async () => {
    const predicted = await factory.predictCompany("ADD");
    await factory.deployCompanyWithDirectInvestment(companyParams("ADD", { restricted: true }), DI);
    const wrapper = await ethers.getContractAt("SharesUnderAgreement", predicted.wrapper);
    await wrapper.connect(owner).transferOwnership(signer1);

    await expect(factory.addSecondaryMarket("ADD")).to.emit(factory, "SecondaryMarketDeployed").withArgs(predicted.wrapper, predicted.market);
    const market = await ethers.getContractAt("SecondaryMarket", predicted.market);
    expect(await market.owner()).to.equal(signer1.address);
    // the factory no longer owns the wrapper, so the issuer types the market
    expect(await wrapper.isAllowed(predicted.market)).to.equal(false);

    // the salt carries the store's version: same version collides, the next version lands on a new address
    await expect(factory.addDirectInvestment("ADD", DI)).to.be.revertedWithCustomError(factory, "Create3_SaltAlreadyUsed");
    const version = await stores.DirectInvestmentFactory.version();
    expect(await factory.predictDirectInvestment("ADD", version)).to.equal(predicted.directInvestment);
    expect(await factory.predictDirectInvestment("ADD", version + 1n)).to.not.equal(predicted.directInvestment);
    expect(await factory.predictSecondaryMarket("ADD", await stores.SecondaryMarketFactory.version())).to.equal(predicted.market);
  });

  it("adds a DirectInvestment to a company deployed without one", async () => {
    const predicted = await factory.predictCompany("LATE");
    await factory.deployCompany(companyParams("LATE"));
    await expect(factory.addDirectInvestment("LATE", DI)).to.emit(factory, "DirectInvestmentDeployed").withArgs(predicted.wrapper, predicted.directInvestment);
    expect(await (await ethers.getContractAt("DirectInvestment", predicted.directInvestment)).owner()).to.equal(owner.address);
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
    expect(v.lockReleaseTokenPool).to.equal(await stores.LockReleaseTokenPoolFactory.version());
    expect(v.bridgedSharesUnderAgreement).to.equal(0n); // store not set
    expect(v.burnMintTokenPool).to.equal(0n);
  });

  it("settings are owner-only and emit", async () => {
    await expect(factory.setCurrency(signer1)).to.emit(factory, "SettingChanged").withArgs("currency", signer1.address);
    expect(await factory.currency()).to.equal(signer1.address);
    await expect(factory.connect(signer1).setCurrency(signer1)).to.be.revertedWithCustomError(factory, "Ownable_NotOwner");
  });

  it("refuses the bridged token on the home chain", async () => {
    await expect(factory.deployBridgedToken("ABC", "ABCS", "ABC Company Shares SHA", "https://abc.test/agreement", false, owner, { chainSelector: MAINNET_SELECTOR, pool: signer1.address })).to.be.revertedWithCustomError(factory, "HomeChain");
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

  it("puts the bridged wrapper on the home-chain wrapper's address, with its pool pointed home", async () => {
    await l2Factory.setBridgedSharesUnderAgreementFactory(await deployStore(l2Ethers, "BridgedSharesUnderAgreementFactory"));
    await l2Factory.setBurnMintTokenPoolFactory(await deployStore(l2Ethers, "BurnMintTokenPoolFactory"));
    await l2Factory.setChainlink(CHAINLINK_POLYGON);
    const home = await homeFactory.predictCompany("ABC"); // the home pool address is known before either side exists
    const predictedPool = await l2Factory.predictBridgedPool("ABC");
    const tx = l2Factory.deployBridgedToken("ABC", "ABCS", "ABC Company Shares SHA", "https://abc.test/agreement", true, owner.address, { chainSelector: MAINNET_SELECTOR, pool: home.pool });
    await expect(tx).to.emit(l2Factory, "BridgedTokenDeployed").withArgs("ABC", owner.address, home.wrapper, predictedPool);
    const token = await l2Ethers.getContractAt("BridgedSharesUnderAgreement", home.wrapper);
    expect(await token.symbol()).to.equal("ABCS");
    expect(await token.owner()).to.equal(owner.address);
    expect(await token.pool()).to.equal(predictedPool);
    expect(await token.defaultType()).to.equal(TYPE_ALLOWED);
    expect(await token.isAllowed(predictedPool)).to.equal(true);
    expect((await l2Factory.versions()).bridgedSharesUnderAgreement).to.equal(await token.VERSION());
    const pool = new l2Ethers.Contract(predictedPool, POOL_ABI, l2Ethers.provider);
    expect(await pool.typeAndVersion()).to.equal("BurnMintTokenPool 2.0.0");
    const coder = l2Ethers.AbiCoder.defaultAbiCoder();
    expect(await pool.getRemotePools(MAINNET_SELECTOR)).to.deep.equal([coder.encode(["address"], [home.pool])]);
    expect(await pool.getRemoteToken(MAINNET_SELECTOR)).to.equal(coder.encode(["address"], [home.wrapper]));
    const registry = new l2Ethers.Contract(CHAINLINK_POLYGON.tokenAdminRegistry, REGISTRY_ABI, l2Ethers.provider);
    expect(await registry.getPool(home.wrapper)).to.equal(predictedPool);
    expect(await pool.owner()).to.equal(await l2Factory.getAddress()); // pending the issuer's acceptOwnership
  });
});
