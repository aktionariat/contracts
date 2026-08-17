import { expect } from "chai";
import { ethers, provider, owner, signer1, signer2 } from "./TestBase.ts";
import { setBalance } from "../scripts/helpers/setBalance.ts";
import {
  BridgedSharesUnderAgreement,
  BurnMintTokenPool,
  BurnMintTokenPoolProxy,
  CCIPLocalSimulator,
  FactoryDestination,
  FactorySource,
  LockReleaseTokenPool,
  LockReleaseTokenPoolProxy,
  RegistryModuleOwnerCustom,
  Shares,
  SharesUnderAgreement,
  TokenAdminRegistry,
} from "../types/ethers-contracts/index.ts";
import { MockRMNProxy } from "../types/ethers-contracts/contracts/mocks/MockRMNProxy.ts";
import { id } from "ethers";

// Tests for factory deployed CCIP bridge
// We test flows:
//    - lock SHA on source, then mint BSHA on destination
//    - burn BSHA on destination and release SHA on source chain.
//
// Deploys source (Shares, SHA and LockReleaseTokenPool) and destination (BSHA and BurnMintTokenPool)
// using FactorySource and FactoryDestination, which also configure CCIP infrastructure.

const CHAIN_SELECTOR = 16015286601757825753n;
const ONRAMP_ADDRESS = "0x00000000000000000000000000000000499602D2"; // address(1234567890)
const SALT = id("test");

const SHARES_PARAMS = {
  symbol: "TEST",
  name: "Test Shares",
  terms: "https://test.com/terms",
};
const SHA_TERMS = "https://test.com/agreement";
const BSHA_PARAMS = {
  symbol: "BTEST",
  name: "Bridged Test Shares",
  terms: "https://test.com/terms",
};

const RATE_LIMITER_CONFIG = { isEnabled: false, capacity: 0, rate: 0 };

describe("FactoryTokenBridge (factory deployment + CCIP bridging)", function () {
  let ccipSimulator: CCIPLocalSimulator;
  let tokenAdminRegistry: TokenAdminRegistry;
  let registryModuleOwner: RegistryModuleOwnerCustom;
  let mockRMN: MockRMNProxy;

  // Implementation contracts
  let sharesImpl: Shares;
  let shaImpl: SharesUnderAgreement;
  let bshaImpl: BridgedSharesUnderAgreement;
  let lockReleasePoolImpl: LockReleaseTokenPool;
  let burnMintPoolImpl: BurnMintTokenPool;

  // Factory contracts
  let factorySource: FactorySource;
  let factoryDestination: FactoryDestination;

  // Deployed tokens and pools
  let shares: Shares;
  let sha: SharesUnderAgreement;
  let bsha: BridgedSharesUnderAgreement;
  let lockReleasePool: LockReleaseTokenPoolProxy;
  let burnMintPool: BurnMintTokenPoolProxy;

  let futureOwner: string;

  before(async () => {
    futureOwner = await owner.getAddress();

    // // CCIP local simulator
    const CCIPLocalSimulator = await ethers.getContractFactory(
      "CCIPLocalSimulator"
    );
    ccipSimulator = await CCIPLocalSimulator.deploy();
    await ccipSimulator.waitForDeployment();

    const config = await ccipSimulator.configuration();
    const mockRouter = config.sourceRouter_;

    // // Needed extra CCIP Infrastructure
    const TokenAdminRegistry = await ethers.getContractFactory(
      "TokenAdminRegistry"
    );
    tokenAdminRegistry = await TokenAdminRegistry.deploy();
    await tokenAdminRegistry.waitForDeployment();

    const RegistryModuleOwnerCustom = await ethers.getContractFactory(
      "RegistryModuleOwnerCustom"
    );
    registryModuleOwner = await RegistryModuleOwnerCustom.deploy(
      await tokenAdminRegistry.getAddress()
    );
    await registryModuleOwner.waitForDeployment();

    const MockRMN = await ethers.getContractFactory("MockRMN");
    mockRMN = await MockRMN.deploy();
    await mockRMN.waitForDeployment();

    // Add the registry module to the TokenAdminRegistry
    await tokenAdminRegistry.addRegistryModule(
      await registryModuleOwner.getAddress()
    );

    // // Deploy Logic Contracts
    const Shares = await ethers.getContractFactory("Shares");
    sharesImpl = await Shares.deploy(
      SHARES_PARAMS.symbol,
      SHARES_PARAMS.name,
      SHARES_PARAMS.terms,
      owner
    );
    await sharesImpl.waitForDeployment();

    const SHA = await ethers.getContractFactory("SharesUnderAgreement");
    shaImpl = await SHA.deploy(
      await sharesImpl.getAddress(),
      SHA_TERMS,
      0,
      owner
    );
    await shaImpl.waitForDeployment();

    const BSHA = await ethers.getContractFactory("BridgedSharesUnderAgreement");
    bshaImpl = await BSHA.deploy(
      BSHA_PARAMS.symbol,
      BSHA_PARAMS.name,
      BSHA_PARAMS.terms,
      owner
    );
    await bshaImpl.waitForDeployment();

    // mock but still correct parameters
    const LockReleasePool = await ethers.getContractFactory(
      "LockReleaseTokenPoolProxy"
    );
    lockReleasePoolImpl = await LockReleasePool.deploy(
      await shaImpl.getAddress(),
      0,
      [],
      await mockRMN.getAddress(),
      true,
      mockRouter
    );
    await lockReleasePoolImpl.waitForDeployment();

    const BurnMintPool = await ethers.getContractFactory(
      "BurnMintTokenPoolProxy"
    );
    burnMintPoolImpl = await BurnMintPool.deploy(
      await bshaImpl.getAddress(),
      0,
      [],
      await mockRMN.getAddress(),
      mockRouter
    );
    await burnMintPoolImpl.waitForDeployment();

    // // Deploy Factories
    const FactorySourceContract = await ethers.getContractFactory(
      "FactorySource"
    );
    factorySource = await FactorySourceContract.deploy(
      await sharesImpl.getAddress(),
      await shaImpl.getAddress(),
      await lockReleasePoolImpl.getAddress()
    );
    await factorySource.waitForDeployment();

    const FactoryDestinationContract = await ethers.getContractFactory(
      "FactoryDestination"
    );
    factoryDestination = await FactoryDestinationContract.deploy(
      await bshaImpl.getAddress(),
      await burnMintPoolImpl.getAddress()
    );
    await factoryDestination.waitForDeployment();

    // Input parameters for source factory
    // Get Chainlink addresses
    const sourceChainlink = {
      tokenAdminRegistry: await tokenAdminRegistry.getAddress(),
      registryModuleOwner: await registryModuleOwner.getAddress(),
      rmnProxy: await mockRMN.getAddress(),
      router: mockRouter,
    };

    // remoteTokenInitCode and remotePoolInitCode have implementation addresses
    // as defined by our custom prediction logic
    const sourceParams = {
      shares: { candidate: ethers.ZeroAddress, ...SHARES_PARAMS },
      sharesUnderAgreement: { candidate: ethers.ZeroAddress, terms: SHA_TERMS },
      chainlink: sourceChainlink,
      remoteTokenPools: [
        {
          remoteChainSelector: CHAIN_SELECTOR,
          remotePoolAddress: "0x",
          remotePoolInitCode: await burnMintPoolImpl.getAddress(),
          remoteChainConfig: {
            remotePoolFactory: await factoryDestination.getAddress(),
            remoteRouter: ethers.ZeroAddress,
            remoteRMNProxy: ethers.ZeroAddress,
            remoteTokenDecimals: 0,
          },
          poolType: 0, // BURN_MINT
          remoteTokenAddress: "0x",
          remoteTokenInitCode: await bshaImpl.getAddress(),
          rateLimiterConfig: RATE_LIMITER_CONFIG,
        },
      ],
    };

    const sourceTx = await factorySource.deploy(
      sourceParams,
      futureOwner,
      SALT
    );
    const sourceReceipt = await sourceTx.wait();

    // Parse events to get deployed addresses
    const sharesDeployedEvent = sourceReceipt!.logs.find(
      (log: any) =>
        factorySource.interface.parseLog(log)?.name === "SharesDeployed"
    );
    const shaDeployedEvent = sourceReceipt!.logs.find(
      (log: any) =>
        factorySource.interface.parseLog(log)?.name ===
        "SharesUnderAgreementDeployed"
    );
    const poolDeployedEvent = sourceReceipt!.logs.find(
      (log: any) =>
        factorySource.interface.parseLog(log)?.name === "TokenPoolDeployed"
    );

    const sourceDeployment = factorySource.interface.parseLog(
      sharesDeployedEvent!
    );
    shares = await ethers.getContractAt(
      "Shares",
      sourceDeployment!.args.proxyToken
    );
    sha = await ethers.getContractAt(
      "SharesUnderAgreement",
      factorySource.interface.parseLog(shaDeployedEvent!)!.args.proxyWrapper
    );
    lockReleasePool = await ethers.getContractAt(
      "LockReleaseTokenPoolProxy",
      factorySource.interface.parseLog(poolDeployedEvent!)!.args.proxyPool
    );

    // Input parameters for destination factory
    // Get Chainlink addresses
    const destChainlink = {
      tokenAdminRegistry: await tokenAdminRegistry.getAddress(),
      registryModuleOwner: await registryModuleOwner.getAddress(),
      rmnProxy: await mockRMN.getAddress(),
      router: mockRouter,
    };

    const destParams = {
      bridgedSharesUnderAgreement: {
        candidate: ethers.ZeroAddress,
        ...BSHA_PARAMS,
      },
      chainlink: destChainlink,
      remoteTokenPools: [
        {
          remoteChainSelector: CHAIN_SELECTOR,
          remotePoolAddress: "0x",
          remotePoolInitCode: await lockReleasePoolImpl.getAddress(),
          remoteChainConfig: {
            remotePoolFactory: await factorySource.getAddress(),
            remoteRouter: ethers.ZeroAddress,
            remoteRMNProxy: ethers.ZeroAddress,
            remoteTokenDecimals: 0,
          },
          poolType: 1, // LOCK_RELEASE
          remoteTokenAddress: "0x",
          remoteTokenInitCode: await shaImpl.getAddress(),
          rateLimiterConfig: RATE_LIMITER_CONFIG,
        },
      ],
    };

    const destTx = await factoryDestination.deploy(
      destParams,
      futureOwner,
      SALT
    );
    const destReceipt = await destTx.wait();

    const bshaDeployedEvent = destReceipt!.logs.find(
      (log: any) =>
        factoryDestination.interface.parseLog(log)?.name ===
        "BridgedSharesUnderAgreementDeployed"
    );
    const destPoolDeployedEvent = destReceipt!.logs.find(
      (log: any) =>
        factoryDestination.interface.parseLog(log)?.name === "TokenPoolDeployed"
    );

    const destDeployment = factoryDestination.interface.parseLog(
      bshaDeployedEvent!
    );
    bsha = await ethers.getContractAt(
      "BridgedSharesUnderAgreement",
      destDeployment!.args.proxyWrapper
    );
    burnMintPool = await ethers.getContractAt(
      "BurnMintTokenPoolProxy",
      factoryDestination.interface.parseLog(destPoolDeployedEvent!)!.args
        .proxyPool
    );

    // // Final acceptance steps
    await lockReleasePool.connect(owner).acceptOwnership();
    await tokenAdminRegistry
      .connect(owner)
      .acceptAdminRole(await sha.getAddress());
    await burnMintPool.connect(owner).acceptOwnership();
    await tokenAdminRegistry
      .connect(owner)
      .acceptAdminRole(await bsha.getAddress());

    // Mint and wrap SHA
    await shares
      .connect(owner)
      .mintAndWrap(signer1, await sha.getAddress(), 200n);
  });

  // // The following tests have high level of manual simulation, because we want
  // // to test t least the pools lock/release and burn/mint calls, local chainlink
  // // ccipSend just does a simple transfer without passing through pools.
  // // See node_modules/@chainlink/local/src/vendor/chainlink-ccip/test/mocks/MockRouter.sol
  it("Lock SHA on source chain and mint BSHA on destination chain", async () => {
    const signer1Addr = await signer1.getAddress();
    const signer2Addr = await signer2.getAddress();
    const amount = 100n;

    // Transfer SHA to the LockRelease pool we simulate Router transferring tokens to pool
    await sha
      .connect(signer1)
      .approve(await lockReleasePool.getAddress(), amount);
    await sha
      .connect(signer1)
      .transfer(await lockReleasePool.getAddress(), amount);
    expect(await sha.balanceOf(await lockReleasePool.getAddress())).to.equal(
      amount
    );

    // Impersonate the onRamp to call lockOrBurn.
    // it is needed because MockRouter hardcodes getOnRamp as address(1234567890)
    await provider.request({
      method: "hardhat_impersonateAccount",
      params: [ONRAMP_ADDRESS],
    });
    await setBalance(ONRAMP_ADDRESS, ethers.parseEther("100"));
    const onRamp = await ethers.getSigner(ONRAMP_ADDRESS);

    // lockOrBurn: We call the lock release token pool
    await lockReleasePool.connect(onRamp).lockOrBurn({
      receiver: ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"],
        [signer2Addr]
      ),
      remoteChainSelector: CHAIN_SELECTOR,
      originalSender: signer1Addr,
      amount,
      localToken: await sha.getAddress(),
    });

    await provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [ONRAMP_ADDRESS],
    });

    // releaseOrMint: We call the burn mint token pool
    // isOffRamp always returns true
    await burnMintPool.releaseOrMint({
      originalSender: ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"],
        [signer1Addr]
      ),
      remoteChainSelector: CHAIN_SELECTOR,
      receiver: signer2Addr,
      amount,
      localToken: await bsha.getAddress(),
      sourcePoolAddress: ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"],
        [await lockReleasePool.getAddress()]
      ),
      sourcePoolData: ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [0]
      ),
      offchainTokenData: "0x",
    });

    expect(await bsha.balanceOf(signer2Addr)).to.equal(amount);
    expect(await sha.balanceOf(await lockReleasePool.getAddress())).to.equal(
      amount
    );
  });

  it("Burn BSHA on destination chain and release SHA on source chain", async () => {
    const signer1Addr = await signer1.getAddress();
    const signer2Addr = await signer2.getAddress();
    const amount = 50n;

    // Transfer BSHA to the BurnMint pool we simulate Router transferring tokens to pool
    await bsha
      .connect(signer2)
      .approve(await burnMintPool.getAddress(), amount);
    await bsha
      .connect(signer2)
      .transfer(await burnMintPool.getAddress(), amount);
    expect(await bsha.balanceOf(await burnMintPool.getAddress())).to.equal(
      amount
    );

    // Impersonate the onRamp to call lockOrBurn
    // it is needed because MockRouter hardcodes getOnRamp as address(1234567890)
    await provider.request({
      method: "hardhat_impersonateAccount",
      params: [ONRAMP_ADDRESS],
    });
    await setBalance(ONRAMP_ADDRESS, ethers.parseEther("100"));
    const onRamp = await ethers.getSigner(ONRAMP_ADDRESS);

    await burnMintPool.connect(onRamp).lockOrBurn({
      receiver: ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"],
        [signer1Addr]
      ),
      remoteChainSelector: CHAIN_SELECTOR,
      originalSender: signer2Addr,
      amount,
      localToken: await bsha.getAddress(),
    });

    await provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [ONRAMP_ADDRESS],
    });

    expect(await bsha.balanceOf(await burnMintPool.getAddress())).to.equal(0n);

    // releaseOrMint: We call the lock release token pool
    // isOffRamp always returns true
    await lockReleasePool.releaseOrMint({
      originalSender: ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"],
        [signer2Addr]
      ),
      remoteChainSelector: CHAIN_SELECTOR,
      receiver: signer1Addr,
      amount,
      localToken: await sha.getAddress(),
      sourcePoolAddress: ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"],
        [await burnMintPool.getAddress()]
      ),
      sourcePoolData: ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [0]
      ),
      offchainTokenData: "0x",
    });

    expect(await sha.balanceOf(signer1Addr)).to.equal(100n + amount);
    expect(await sha.balanceOf(await lockReleasePool.getAddress())).to.equal(
      100n - amount
    );
  });
});
