import { ethers, provider, owner, signer1 } from "./TestBase.ts";
import { setBalance } from "../scripts/helpers/setBalance.ts";
import {
  BridgedSharesUnderAgreement,
  BurnMintTokenPool,
  BurnMintTokenPoolProxy,
  FactoryDestination,
  FactorySource,
  LockReleaseTokenPool,
  LockReleaseTokenPoolProxy,
  Shares,
  SharesUnderAgreement,
  TokenAdminRegistry,
} from "../types/ethers-contracts/index.ts";
import { MockRMNProxy } from "../types/ethers-contracts/contracts/mocks/MockRMNProxy.ts";
import { id } from "ethers";

export const CHAIN_SELECTOR = 16015286601757825753n;
export const ONRAMP_ADDRESS = "0x00000000000000000000000000000000499602D2";
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

export interface BridgeFixture {
  shares: Shares;
  sha: SharesUnderAgreement;
  bsha: BridgedSharesUnderAgreement;
  lockReleasePool: LockReleaseTokenPoolProxy;
  burnMintPool: BurnMintTokenPoolProxy;
  factorySource: FactorySource;
  tokenAdminRegistry: TokenAdminRegistry;
}

export async function deployBridgeFixture(): Promise<BridgeFixture> {
  const futureOwner = await owner.getAddress();

  // // CCIP Infra
  const CCIPLocalSimulator = await ethers.getContractFactory(
    "CCIPLocalSimulator"
  );
  const ccipSimulator = await CCIPLocalSimulator.deploy();
  await ccipSimulator.waitForDeployment();
  const config = await ccipSimulator.configuration();
  const mockRouter = config.sourceRouter_;

  const TokenAdminRegistry = await ethers.getContractFactory(
    "TokenAdminRegistry"
  );
  const tokenAdminRegistry = await TokenAdminRegistry.deploy();
  await tokenAdminRegistry.waitForDeployment();

  const RegistryModuleOwnerCustom = await ethers.getContractFactory(
    "RegistryModuleOwnerCustom"
  );
  const registryModuleOwner = await RegistryModuleOwnerCustom.deploy(
    await tokenAdminRegistry.getAddress()
  );
  await registryModuleOwner.waitForDeployment();

  const MockRMN = await ethers.getContractFactory("MockRMN");
  const mockRMN: MockRMNProxy = await MockRMN.deploy();
  await mockRMN.waitForDeployment();

  await tokenAdminRegistry.addRegistryModule(
    await registryModuleOwner.getAddress()
  );

  // // Implementation Addresses
  const SharesFactory = await ethers.getContractFactory("Shares");
  const sharesImpl: Shares = await SharesFactory.deploy(
    SHARES_PARAMS.symbol,
    SHARES_PARAMS.name,
    SHARES_PARAMS.terms,
    owner
  );
  await sharesImpl.waitForDeployment();

  const SHAFactory = await ethers.getContractFactory("SharesUnderAgreement");
  const shaImpl: SharesUnderAgreement = await SHAFactory.deploy(
    await sharesImpl.getAddress(),
    SHA_TERMS,
    0,
    owner
  );
  await shaImpl.waitForDeployment();

  const BSHAFactory = await ethers.getContractFactory(
    "BridgedSharesUnderAgreement"
  );
  const bshaImpl: BridgedSharesUnderAgreement = await BSHAFactory.deploy(
    BSHA_PARAMS.symbol,
    BSHA_PARAMS.name,
    BSHA_PARAMS.terms,
    owner
  );
  await bshaImpl.waitForDeployment();

  const LockReleasePool = await ethers.getContractFactory(
    "LockReleaseTokenPoolProxy"
  );
  const lockReleasePoolImpl: LockReleaseTokenPool =
    await LockReleasePool.deploy(
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
  const burnMintPoolImpl: BurnMintTokenPool = await BurnMintPool.deploy(
    await bshaImpl.getAddress(),
    0,
    [],
    await mockRMN.getAddress(),
    mockRouter
  );
  await burnMintPoolImpl.waitForDeployment();

  // // Factories
  const FactorySourceContract = await ethers.getContractFactory(
    "FactorySource"
  );
  const factorySource: FactorySource = await FactorySourceContract.deploy(
    await sharesImpl.getAddress(),
    await shaImpl.getAddress(),
    await lockReleasePoolImpl.getAddress()
  );
  await factorySource.waitForDeployment();

  const FactoryDestinationContract = await ethers.getContractFactory(
    "FactoryDestination"
  );
  const factoryDestination: FactoryDestination =
    await FactoryDestinationContract.deploy(
      await bshaImpl.getAddress(),
      await burnMintPoolImpl.getAddress()
    );
  await factoryDestination.waitForDeployment();

  // // Source Chain
  const chainlink = {
    tokenAdminRegistry: await tokenAdminRegistry.getAddress(),
    registryModuleOwner: await registryModuleOwner.getAddress(),
    rmnProxy: await mockRMN.getAddress(),
    router: mockRouter,
  };

  const sourceTx = await factorySource.deploy(
    {
      shares: { candidate: ethers.ZeroAddress, ...SHARES_PARAMS },
      sharesUnderAgreement: { candidate: ethers.ZeroAddress, terms: SHA_TERMS },
      chainlink,
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
          poolType: 0,
          remoteTokenAddress: "0x",
          remoteTokenInitCode: await bshaImpl.getAddress(),
          rateLimiterConfig: RATE_LIMITER_CONFIG,
        },
      ],
    },
    futureOwner,
    SALT
  );
  const sourceReceipt = await sourceTx.wait();

  const sharesEvent = sourceReceipt!.logs.find(
    (l: any) => factorySource.interface.parseLog(l)?.name === "SharesDeployed"
  );
  const shaEvent = sourceReceipt!.logs.find(
    (l: any) =>
      factorySource.interface.parseLog(l)?.name ===
      "SharesUnderAgreementDeployed"
  );
  const poolEvent = sourceReceipt!.logs.find(
    (l: any) =>
      factorySource.interface.parseLog(l)?.name === "TokenPoolDeployed"
  );

  const shares: Shares = await ethers.getContractAt(
    "Shares",
    factorySource.interface.parseLog(sharesEvent!)!.args.proxyToken
  );
  const sha: SharesUnderAgreement = await ethers.getContractAt(
    "SharesUnderAgreement",
    factorySource.interface.parseLog(shaEvent!)!.args.proxyWrapper
  );
  const lockReleasePool: LockReleaseTokenPoolProxy = await ethers.getContractAt(
    "LockReleaseTokenPoolProxy",
    factorySource.interface.parseLog(poolEvent!)!.args.proxyPool
  );

  // // Destination Chain
  const destTx = await factoryDestination.deploy(
    {
      bridgedSharesUnderAgreement: {
        candidate: ethers.ZeroAddress,
        ...BSHA_PARAMS,
      },
      chainlink,
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
          poolType: 1,
          remoteTokenAddress: "0x",
          remoteTokenInitCode: await shaImpl.getAddress(),
          rateLimiterConfig: RATE_LIMITER_CONFIG,
        },
      ],
    },
    futureOwner,
    SALT
  );
  const destReceipt = await destTx.wait();

  const bshaEvent = destReceipt!.logs.find(
    (l: any) =>
      factoryDestination.interface.parseLog(l)?.name ===
      "BridgedSharesUnderAgreementDeployed"
  );
  const destPoolEvent = destReceipt!.logs.find(
    (l: any) =>
      factoryDestination.interface.parseLog(l)?.name === "TokenPoolDeployed"
  );

  const bsha: BridgedSharesUnderAgreement = await ethers.getContractAt(
    "BridgedSharesUnderAgreement",
    factoryDestination.interface.parseLog(bshaEvent!)!.args.proxyWrapper
  );
  const burnMintPool: BurnMintTokenPoolProxy = await ethers.getContractAt(
    "BurnMintTokenPoolProxy",
    factoryDestination.interface.parseLog(destPoolEvent!)!.args.proxyPool
  );

  // // Ending acceptances
  await lockReleasePool.connect(owner).acceptOwnership();
  await tokenAdminRegistry
    .connect(owner)
    .acceptAdminRole(await sha.getAddress());
  await burnMintPool.connect(owner).acceptOwnership();
  await tokenAdminRegistry
    .connect(owner)
    .acceptAdminRole(await bsha.getAddress());

  await shares
    .connect(owner)
    .mintAndWrap(signer1, await sha.getAddress(), 200n);

  return {
    shares,
    sha,
    bsha,
    lockReleasePool,
    burnMintPool,
    factorySource,
    tokenAdminRegistry,
  };
}

// // Bridge helpers
export async function lockSourceAndMintDest(
  fixture: BridgeFixture,
  originalSender: string,
  receiver: string,
  amount: bigint
) {
  const { sha, bsha, lockReleasePool, burnMintPool } = fixture;
  const encode = (type: string, val: any) =>
    ethers.AbiCoder.defaultAbiCoder().encode([type], [val]);

  // remember that we impersonate onRamp since only onRamp can call, as mock router
  // returns address(12345678)
  await provider.request({
    method: "hardhat_impersonateAccount",
    params: [ONRAMP_ADDRESS],
  });
  await setBalance(ONRAMP_ADDRESS, ethers.parseEther("100"));
  const onRamp = await ethers.getSigner(ONRAMP_ADDRESS);

  await lockReleasePool.connect(onRamp).lockOrBurn({
    receiver: encode("address", receiver),
    remoteChainSelector: CHAIN_SELECTOR,
    originalSender,
    amount,
    localToken: await sha.getAddress(),
  });

  await provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [ONRAMP_ADDRESS],
  });

  // isOffRamp returns always true
  await burnMintPool.releaseOrMint({
    originalSender: encode("address", originalSender),
    remoteChainSelector: CHAIN_SELECTOR,
    receiver,
    amount,
    localToken: await bsha.getAddress(),
    sourcePoolAddress: encode("address", await lockReleasePool.getAddress()),
    sourcePoolData: encode("uint256", 0),
    offchainTokenData: "0x",
  });
}

export async function burnDestAndReleaseSource(
  fixture: BridgeFixture,
  originalSender: string,
  receiver: string,
  amount: bigint
) {
  const { sha, bsha, lockReleasePool, burnMintPool } = fixture;
  const encode = (type: string, val: any) =>
    ethers.AbiCoder.defaultAbiCoder().encode([type], [val]);

  // remember that we impersonate onRamp since only onRamp can call, as mock router
  // returns address(12345678)
  await provider.request({
    method: "hardhat_impersonateAccount",
    params: [ONRAMP_ADDRESS],
  });
  await setBalance(ONRAMP_ADDRESS, ethers.parseEther("100"));
  const onRamp = await ethers.getSigner(ONRAMP_ADDRESS);

  await burnMintPool.connect(onRamp).lockOrBurn({
    receiver: encode("address", receiver),
    remoteChainSelector: CHAIN_SELECTOR,
    originalSender,
    amount,
    localToken: await bsha.getAddress(),
  });

  await provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [ONRAMP_ADDRESS],
  });

  // isOffRamp returns always true
  await lockReleasePool.releaseOrMint({
    originalSender: encode("address", originalSender),
    remoteChainSelector: CHAIN_SELECTOR,
    receiver,
    amount,
    localToken: await sha.getAddress(),
    sourcePoolAddress: encode("address", await burnMintPool.getAddress()),
    sourcePoolData: encode("uint256", 0),
    offchainTokenData: "0x",
  });
}
