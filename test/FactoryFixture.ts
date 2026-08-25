import { ethers, provider, owner, signer1 } from "./TestBase.ts";
import { setBalance } from "../scripts/helpers/setBalance.ts";
import {
  BridgedSharesUnderAgreement,
  BurnMintTokenPool,
  FactoryDestination,
  FactorySource,
  LockReleaseTokenPool,
  Shares,
  SharesUnderAgreement,
  TokenAdminRegistry,
  MockRMN,
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

  // // Get bytecodes for CREATE2 address prediction
  const SharesFactory = await ethers.getContractFactory("Shares");
  const SHAFactory = await ethers.getContractFactory("SharesUnderAgreement");
  const BSHAFactory = await ethers.getContractFactory(
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

  // // Deploy Aktionariat factories
  const FactorySourceContract = await ethers.getContractFactory(
    "FactorySource"
  );
  const factorySource: FactorySource = await FactorySourceContract.deploy();
  await factorySource.waitForDeployment();

  const FactoryDestinationContract = await ethers.getContractFactory(
    "FactoryDestination"
  );
  const factoryDestination: FactoryDestination =
    await FactoryDestinationContract.deploy();
  await factoryDestination.waitForDeployment();

  const factorySourceAddr = await factorySource.getAddress();
  const factoryDestAddr = await factoryDestination.getAddress();
  const tokenPoolFactoryAddr = await tokenPoolFactory.getAddress();
  const rmnProxyAddr = await mockRMN.getAddress();

  // // Predict token addresses via CREATE2
  const encode = (types: string[], values: any[]) =>
    ethers.AbiCoder.defaultAbiCoder().encode(types, values);

  // Shares: deployed by FactorySource
  const sharesInitCode = ethers.concat([
    SharesFactory.bytecode,
    encode(
      ["string", "string", "string", "address"],
      [
        SHARES_PARAMS.symbol,
        SHARES_PARAMS.name,
        SHARES_PARAMS.terms,
        // TODO
        factorySourceAddr,
      ]
    ),
  ]);
  const sharesAddr = ethers.getCreate2Address(
    factorySourceAddr,
    SALT,
    ethers.keccak256(sharesInitCode)
  );

  // SHA: deployed by FactorySource
  const shaInitCode = ethers.concat([
    SHAFactory.bytecode,
    encode(
      ["address", "string", "uint8", "address"],
      [sharesAddr, SHA_TERMS, 0, factorySourceAddr]
    ),
  ]);
  const shaAddr = ethers.getCreate2Address(
    factorySourceAddr,
    SALT,
    ethers.keccak256(shaInitCode)
  );

  // BSHA: deployed by FactoryDestination
  const bshaInitCode = ethers.concat([
    BSHAFactory.bytecode,
    encode(
      ["string", "string", "string", "address"],
      [BSHA_PARAMS.symbol, BSHA_PARAMS.name, BSHA_PARAMS.terms, factoryDestAddr]
    ),
  ]);
  const bshaAddr = ethers.getCreate2Address(
    factoryDestAddr,
    SALT,
    ethers.keccak256(bshaInitCode)
  );

  // // Predict pool addresses via CREATE2, pools are deployed by TokenPoolFactory
  // TokenPoolFactory modifies salt: salt = keccak256(abi.encodePacked(salt, msg.sender))
  const lockReleaseSalt = ethers.keccak256(
    ethers.solidityPacked(["bytes32", "address"], [SALT, factorySourceAddr])
  );
  const burnMintSalt = ethers.keccak256(
    ethers.solidityPacked(["bytes32", "address"], [SALT, factoryDestAddr])
  );

  // LockRelease pool: constructor(token, decimals, allowlist, rmnProxy, acceptLiquidity, router)
  const lockReleasePoolInitCode = ethers.concat([
    lockReleaseBytecode,
    encode(
      ["address", "uint8", "address[]", "address", "bool", "address"],
      [shaAddr, 0, [], rmnProxyAddr, true, mockRouter]
    ),
  ]);
  const lockReleasePoolAddr = ethers.getCreate2Address(
    tokenPoolFactoryAddr,
    lockReleaseSalt,
    ethers.keccak256(lockReleasePoolInitCode)
  );

  // BurnMint pool: constructor(token, decimals, allowlist, rmnProxy, router)
  const burnMintPoolInitCode = ethers.concat([
    burnMintBytecode,
    encode(
      ["address", "uint8", "address[]", "address", "address"],
      [bshaAddr, 0, [], rmnProxyAddr, mockRouter]
    ),
  ]);
  const burnMintPoolAddr = ethers.getCreate2Address(
    tokenPoolFactoryAddr,
    burnMintSalt,
    ethers.keccak256(burnMintPoolInitCode)
  );

  // // Source Chain deployment
  const chainlink = {
    tokenPoolFactory: tokenPoolFactoryAddr,
    tokenAdminRegistry: await tokenAdminRegistry.getAddress(),
    registryModuleOwner: await registryModuleOwner.getAddress(),
  };

  const sourceTx = await factorySource.deploy(
    {
      shares: {
        candidate: ethers.ZeroAddress,
        bytecode: SharesFactory.bytecode,
        ...SHARES_PARAMS,
      },
      sharesUnderAgreement: {
        candidate: ethers.ZeroAddress,
        bytecode: SHAFactory.bytecode,
        terms: SHA_TERMS,
      },
      chainlink,
      lockReleaseTokenPoolBytecode: lockReleaseBytecode,
      remoteTokenPools: [
        {
          remoteChainSelector: CHAIN_SELECTOR,
          remotePoolAddress: encode(["address"], [burnMintPoolAddr]),
          remotePoolInitCode: burnMintBytecode,
          remoteChainConfig: {
            remotePoolFactory: factoryDestAddr,
            remoteRouter: ethers.ZeroAddress,
            remoteRMNProxy: ethers.ZeroAddress,
            remoteTokenDecimals: 0,
          },
          poolType: 0,
          remoteTokenAddress: encode(["address"], [bshaAddr]),
          remoteTokenInitCode: BSHAFactory.bytecode,
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

  const actualSharesAddr = factorySource.interface.parseLog(sharesEvent!)!.args
    .token;

  const shares: Shares = await ethers.getContractAt("Shares", actualSharesAddr);
  const actualShaAddr = factorySource.interface.parseLog(shaEvent!)!.args
    .wrapper;

  const sha: SharesUnderAgreement = await ethers.getContractAt(
    "SharesUnderAgreement",
    actualShaAddr
  );
  const actualLockReleaseAddr = factorySource.interface.parseLog(poolEvent!)!
    .args.pool;

  const lockReleasePool: LockReleaseTokenPool = await ethers.getContractAt(
    "LockReleaseTokenPool",
    actualLockReleaseAddr
  );

  // // Destination Chain deployment
  const destTx = await factoryDestination.deploy(
    {
      bridgedSharesUnderAgreement: {
        candidate: ethers.ZeroAddress,
        bytecode: BSHAFactory.bytecode,
        ...BSHA_PARAMS,
      },
      chainlink,
      burnMintTokenPoolBytecode: burnMintBytecode,
      remoteTokenPools: [
        {
          remoteChainSelector: CHAIN_SELECTOR,
          remotePoolAddress: encode(["address"], [lockReleasePoolAddr]),
          remotePoolInitCode: lockReleaseBytecode,
          remoteChainConfig: {
            remotePoolFactory: factorySourceAddr,
            remoteRouter: ethers.ZeroAddress,
            remoteRMNProxy: ethers.ZeroAddress,
            remoteTokenDecimals: 0,
          },
          poolType: 1,
          remoteTokenAddress: encode(["address"], [shaAddr]),
          remoteTokenInitCode: SHAFactory.bytecode,
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

  const actualBshaAddr = factoryDestination.interface.parseLog(bshaEvent!)!.args
    .wrapper;

  const bsha: BridgedSharesUnderAgreement = await ethers.getContractAt(
    "BridgedSharesUnderAgreement",
    actualBshaAddr
  );
  const actualBurnMintAddr = factoryDestination.interface.parseLog(
    destPoolEvent!
  )!.args.pool;

  const burnMintPool: BurnMintTokenPool = await ethers.getContractAt(
    "BurnMintTokenPool",
    actualBurnMintAddr
  );

  // // Ownership acceptances
  // LockRelease pool: TokenPoolFactory transferred ownership to FactorySource
  // then CCIPService accepted and transferred to futureOwner
  // futureOwner (= owner) must accept
  await lockReleasePool.connect(owner).acceptOwnership();
  // Token admin: FactorySource registered as admin, then transferred to futureOwner
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
