import { ethers, provider, owner, signer1 } from "./TestBase.ts";
import { setBalance } from "../scripts/helpers/setBalance.ts";
import {
  BridgedSharesUnderAgreement,
  BurnMintTokenPool,
  LockReleaseTokenPool,
  Shares,
  SharesUnderAgreement,
  TokenAdminRegistry,
  MockRMN,
  TokenDeploymentManagerDestination,
  TokenDeploymentManagerSource,
} from "../types/ethers-contracts/index.ts";
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
  lockReleasePool: LockReleaseTokenPool;
  burnMintPool: BurnMintTokenPool;
  factorySource: TokenDeploymentManagerSource;
  factoryDestination: TokenDeploymentManagerDestination;
  tokenAdminRegistry: TokenAdminRegistry;
}

export async function deployBridgeFixture(): Promise<BridgeFixture> {
  // const futureOwner = await owner.getAddress();
  const futureOwner = ethers.ZeroAddress;

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
  const mockRMN: MockRMN = await MockRMN.deploy();
  await mockRMN.waitForDeployment();

  await tokenAdminRegistry.addRegistryModule(
    await registryModuleOwner.getAddress()
  );

  // Deploy Chainlink TokenPoolFactory on source chain
  const TokenPoolFactoryContract = await ethers.getContractFactory(
    "TokenPoolFactory"
  );
  const tokenPoolFactory = await TokenPoolFactoryContract.deploy(
    await tokenAdminRegistry.getAddress(),
    await registryModuleOwner.getAddress(),
    await mockRMN.getAddress(),
    mockRouter
  );
  await tokenPoolFactory.waitForDeployment();

  // // Get bytecodes for the logic factory sub-deployers (CREATE2 prediction is
  // // now done on-chain via the managers' `predict` functions).
  const SharesArtifact = await ethers.getContractFactory("Shares");
  const SHAArtifact = await ethers.getContractFactory("SharesUnderAgreement");
  const BSHAArtifact = await ethers.getContractFactory(
    "BridgedSharesUnderAgreement"
  );
  const LockReleasePoolArtifact = await ethers.getContractFactory(
    "LockReleaseTokenPool"
  );
  const BurnMintPoolArtifact = await ethers.getContractFactory(
    "BurnMintTokenPool"
  );

  const lockReleaseBytecode = LockReleasePoolArtifact.bytecode;
  const burnMintBytecode = BurnMintPoolArtifact.bytecode;

  const tokenPoolFactoryAddr = await tokenPoolFactory.getAddress();
  const rmnProxyAddr = await mockRMN.getAddress();

  // Chainlink addresses shared by the pool logic factories (source + destination)
  const chainlinkAddresses = {
    tokenPoolFactory: tokenPoolFactoryAddr,
    tokenAdminRegistry: await tokenAdminRegistry.getAddress(),
    registryModuleOwner: await registryModuleOwner.getAddress(),
    rmnProxy: rmnProxyAddr,
    router: mockRouter,
  };

  // // Source chain: deploy the logic sub-factories (bytecode + chainlink)
  const SharesFactoryContract = await ethers.getContractFactory(
    "SharesFactory"
  );
  const sharesFactory = await SharesFactoryContract.connect(owner).deploy(
    SharesArtifact.bytecode
  );
  await sharesFactory.waitForDeployment();

  const SHAFactoryContract = await ethers.getContractFactory("SHAFactory");
  const shaFactory = await SHAFactoryContract.connect(owner).deploy(
    SHAArtifact.bytecode
  );
  await shaFactory.waitForDeployment();

  const LockReleaseFactoryContract = await ethers.getContractFactory(
    "CCIPLockReleaseTokenPoolFactory"
  );
  const lockReleaseFactory = await LockReleaseFactoryContract.connect(
    owner
  ).deploy(lockReleaseBytecode, chainlinkAddresses);
  await lockReleaseFactory.waitForDeployment();

  // // Deploy the source deployment manager
  const FactorySourceContract = await ethers.getContractFactory(
    "TokenDeploymentManagerSource"
  );
  const factorySource: TokenDeploymentManagerSource =
    await FactorySourceContract.connect(owner).deploy(
      await sharesFactory.getAddress(),
      await shaFactory.getAddress(),
      await lockReleaseFactory.getAddress()
    );
  await factorySource.waitForDeployment();

  // // Destination chain: deploy the logic sub-factories (bytecode + chainlink)
  const BridgedSHAFactoryContract = await ethers.getContractFactory(
    "BridgedSHAFactory"
  );
  const bridgedSHAFactory = await BridgedSHAFactoryContract.connect(
    owner
  ).deploy(BSHAArtifact.bytecode);
  await bridgedSHAFactory.waitForDeployment();

  const BurnMintFactoryContract = await ethers.getContractFactory(
    "CCIPBurnMintTokenPoolFactory"
  );
  const burnMintFactory = await BurnMintFactoryContract.connect(owner).deploy(
    burnMintBytecode,
    chainlinkAddresses
  );
  await burnMintFactory.waitForDeployment();

  // // Deploy the destination deployment manager
  const FactoryDestinationContract = await ethers.getContractFactory(
    "TokenDeploymentManagerDestination"
  );
  const factoryDestination: TokenDeploymentManagerDestination =
    await FactoryDestinationContract.connect(owner).deploy(
      await bridgedSHAFactory.getAddress(),
      await burnMintFactory.getAddress()
    );
  await factoryDestination.waitForDeployment();

  const factorySourceAddr = await factorySource.getAddress();
  const factoryDestAddr = await factoryDestination.getAddress();

  // // Predict destination token + pool addresses on-chain via the destination
  // // manager. This is independent of the source deployment, so it can run first.
  const bshaParams = {
    candidate: ethers.ZeroAddress,
    symbol: BSHA_PARAMS.symbol,
    name: BSHA_PARAMS.name,
    terms: BSHA_PARAMS.terms,
  };
  const predictedDest = await factoryDestination.predict(bshaParams, SALT);
  const bshaAddr = predictedDest.token.bridgedSharesUnderAgreement;
  const burnMintPoolAddr = predictedDest.tokenPool.burnMintTokenPool;

  // // Source Chain deployment
  const encode = (types: string[], values: any[]) =>
    ethers.AbiCoder.defaultAbiCoder().encode(types, values);

  const sourceTx = await factorySource.connect(owner).deploy(
    {
      shares: {
        candidate: ethers.ZeroAddress,
        symbol: SHARES_PARAMS.symbol,
        name: SHARES_PARAMS.name,
        terms: SHARES_PARAMS.terms,
      },
      sharesUnderAgreement: {
        candidate: ethers.ZeroAddress,
        terms: SHA_TERMS,
      },
      remoteTokenPools: [
        {
          remoteChainSelector: CHAIN_SELECTOR,

          // predicted destination burn-mint pool address
          remotePoolAddress: encode(["address"], [burnMintPoolAddr]),
          remotePoolInitCode: "0x",

          remoteChainConfig: {
            remotePoolFactory: factoryDestAddr,
            remoteRouter: ethers.ZeroAddress,
            remoteRMNProxy: ethers.ZeroAddress,
            remoteTokenDecimals: 0,
          },
          poolType: 0,

          // predicted destination BSHA address
          remoteTokenAddress: encode(["address"], [bshaAddr]),
          remoteTokenInitCode: "0x",

          rateLimiterConfig: RATE_LIMITER_CONFIG,
        },
      ],
    },
    futureOwner,
    SALT
  );
  const sourceReceipt = await sourceTx.wait();

  // The managers emit no events themselves: tokens/pools are deployed by the
  // logic sub-factories, which emit TokenDeployed (param `deployed`) and
  // PoolDeployed (param `pool`). Match each log to its emitting factory.
  const sharesFactoryAddr = await sharesFactory.getAddress();
  const shaFactoryAddr = await shaFactory.getAddress();
  const lockReleaseFactoryAddr = await lockReleaseFactory.getAddress();

  const sharesEvent = sourceReceipt!.logs.find(
    (l: any) =>
      l.address === sharesFactoryAddr &&
      sharesFactory.interface.parseLog(l)?.name === "TokenDeployed"
  );
  const shaEvent = sourceReceipt!.logs.find(
    (l: any) =>
      l.address === shaFactoryAddr &&
      shaFactory.interface.parseLog(l)?.name === "TokenDeployed"
  );
  const poolEvent = sourceReceipt!.logs.find(
    (l: any) =>
      l.address === lockReleaseFactoryAddr &&
      lockReleaseFactory.interface.parseLog(l)?.name === "PoolDeployed"
  );

  const actualSharesAddr = sharesFactory.interface.parseLog(sharesEvent!)!.args
    .deployed;

  const shares: Shares = await ethers.getContractAt("Shares", actualSharesAddr);
  const actualShaAddr = shaFactory.interface.parseLog(shaEvent!)!.args.deployed;

  const sha: SharesUnderAgreement = await ethers.getContractAt(
    "SharesUnderAgreement",
    actualShaAddr
  );
  const actualLockReleaseAddr = lockReleaseFactory.interface.parseLog(
    poolEvent!
  )!.args.pool;

  const lockReleasePool: LockReleaseTokenPool = await ethers.getContractAt(
    "LockReleaseTokenPool",
    actualLockReleaseAddr
  );

  // // Destination Chain deployment
  const destTx = await factoryDestination.connect(owner).deploy(
    {
      bridgedSharesUnderAgreement: bshaParams,
      remoteTokenPools: [
        {
          remoteChainSelector: CHAIN_SELECTOR,

          // actual source lock-release pool address (already deployed)
          remotePoolAddress: encode(["address"], [actualLockReleaseAddr]),
          remotePoolInitCode: "0x",

          remoteChainConfig: {
            remotePoolFactory: factorySourceAddr,
            remoteRouter: ethers.ZeroAddress,
            remoteRMNProxy: ethers.ZeroAddress,
            remoteTokenDecimals: 0,
          },
          poolType: 1,

          // actual source SHA address (already deployed)
          remoteTokenAddress: encode(["address"], [actualShaAddr]),
          remoteTokenInitCode: "0x",

          rateLimiterConfig: RATE_LIMITER_CONFIG,
        },
      ],
    },
    futureOwner,
    SALT
  );
  const destReceipt = await destTx.wait();

  // Same as source: parse events from the emitting logic sub-factories.
  const bridgedSHAFactoryAddr = await bridgedSHAFactory.getAddress();
  const burnMintFactoryAddr = await burnMintFactory.getAddress();

  const bshaEvent = destReceipt!.logs.find(
    (l: any) =>
      l.address === bridgedSHAFactoryAddr &&
      bridgedSHAFactory.interface.parseLog(l)?.name === "TokenDeployed"
  );
  const destPoolEvent = destReceipt!.logs.find(
    (l: any) =>
      l.address === burnMintFactoryAddr &&
      burnMintFactory.interface.parseLog(l)?.name === "PoolDeployed"
  );

  const actualBshaAddr = bridgedSHAFactory.interface.parseLog(bshaEvent!)!.args
    .deployed;

  const bsha: BridgedSharesUnderAgreement = await ethers.getContractAt(
    "BridgedSharesUnderAgreement",
    actualBshaAddr
  );
  const actualBurnMintAddr = burnMintFactory.interface.parseLog(
    destPoolEvent!
  )!.args.pool;

  const burnMintPool: BurnMintTokenPool = await ethers.getContractAt(
    "BurnMintTokenPool",
    actualBurnMintAddr
  );

  // // Ownership acceptances
  // LockRelease pool: TokenPoolFactory transferred ownership to the pool logic
  // factory, then CCIPService accepted and transferred to futureOwner
  // futureOwner (= owner) must accept
  await lockReleasePool.connect(owner).acceptOwnership();
  // Token admin: the pool logic factory registered as admin, then transferred to futureOwner
  await tokenAdminRegistry
    .connect(owner)
    .acceptAdminRole(await sha.getAddress());
  // BurnMint pool: same pattern
  await burnMintPool.connect(owner).acceptOwnership();
  await tokenAdminRegistry
    .connect(owner)
    .acceptAdminRole(await bsha.getAddress());

  // Mint and wrap 200 SHA for signer1
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
    factoryDestination,
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
