// /**
//  * DestinationChainModule ignition script to deploy destination chain contracts
//  * and connect to chainlink CCIP from a yet to be connected destinatio chain
//  */

// import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// import { PoolType, RemoteTokenPoolInfo } from "./lib/types.ts";

// import { CREATE2_SALT } from "./lib/config.ts";

// export default buildModule("DestinationChainModule", (m) => {
//   // source addresses
//   const tokenPoolFactory = m.getParameter<string>("tokenPoolFactory");
//   const registryModuleOwner = m.getParameter<string>("registryModuleOwner");
//   const tokenAdminRegistry = m.getParameter<string>("tokenAdminRegistry");

//   // destination addresses
//   const sourceChainSelector = m.getParameter<bigint>("sourceChainSelector");
//   const sourcePoolFactory = m.getParameter<string>("sourcePoolFactory");
//   const sourceRouter = m.getParameter<string>("sourceRouter");
//   const sourceRMNProxy = m.getParameter<string>("sourceRMNProxy");

//   // remote
//   const remotePoolAddress = m.getParameter<string>("remotePoolAddress");
//   const remoteTokenAddress = m.getParameter<string>("remoteTokenAddress");

//   const decimals = m.getParameter("decimals", 0);

//   // after:
//   //  - Deploy Token (Shares then SharesUnderAgreement)
//   // Deploy pool: BurnMintTokenPool (0x169ed058) at tokenPoolFactory
//   // with deployTokenPoolWithExistingToken(...)
//   const TokenPoolFactory = m.contractAt("TokenPoolFactory", tokenPoolFactory);
//   const remoteTokenPoolInfo: RemoteTokenPoolInfo = {
//     remoteChainSelector: sourceChainSelector,

//     remotePoolAddress: remotePoolAddress,
//     remotePoolInitCode: "", // omitted because of exact address

//     remoteChainConfig: {
//       remotePoolFactory: sourcePoolFactory,
//       remoteRouter: sourceRouter,
//       remoteRMNProxy: sourceRMNProxy,

//       // can be hardcoded to 0 for Shares
//       remoteTokenDecimals: 0,
//     },

//     poolType: PoolType.LOCK_RELEASE,

//     remoteTokenAddress: remoteTokenAddress,
//     remoteTokenInitCode: "", // omitted because of exact address

//     // disabled
//     rateLimiterConfig: {
//       isEnabled: false,
//       capacity: 0n,
//       rate: 0n,
//     },
//   };
//   const burnMintTokenPoolBytecode = m.getParameter<string>(
//     "burnMintTokenPoolBytecode"
//   );
//   const burnMintTokenPoolAddressTransaction = m.call(
//     TokenPoolFactory,
//     "deployTokenPoolWithExistingToken",
//     [
//       BridgedSharesUnderAgreement,
//       decimals,
//       [remoteTokenPoolInfo],
//       burnMintTokenPoolBytecode,
//       CREATE2_SALT,
//       PoolType.BURN_MINT,
//     ]
//   );

//   // registration might be done in parallel with pool deplyment2
//   // after:
//   //  - Deploy pool
//   // Register Token to RegistryModuleOwnerCustom
//   // with registerAdminViaOwner(address token)
//   const RegistryModuleOwnerCustom = m.contractAt(
//     "RegistryModuleOwnerCustom",
//     registryModuleOwner
//   );
//   const registerTroken = m.call(
//     RegistryModuleOwnerCustom,
//     "registerAdminViaOwner",
//     [BridgedSharesUnderAgreement],
//     { after: [burnMintTokenPoolAddressTransaction] }
//   );

//   // after:
//   //  - Deploy pool
//   // Grant Roles: Manual Developer Granting of TokenPool burn/mint in bridged token
//   // with setPool(address _pool)
//   // (I need the just deployed pool address as input)
//   m.call(
//     BridgedSharesUnderAgreement,
//     "setPool",
//     //@ts-expect-error
//     [burnMintTokenPoolAddressTransaction],
//     { after: [burnMintTokenPoolAddressTransaction] }
//   );

//   // Read BurnMintTokenPool Contract
//   const BurnMintTokenPool = m.contractAt(
//     "BurnMintTokenPool",
//     //@ts-ignore
//     burnMintTokenPoolAddressTransaction,
//     {
//       // wait for its deployment
//       after: [burnMintTokenPoolAddressTransaction],
//     }
//   );

//   // after:
//   //  - Deploy pool
//   //  - Register Token
//   // Accept Pool Ownership
//   // BurnMintTokenPool ownership by deployer
//   // with acceptOwnership()
//   const acceptPoolOwnership = m.call(BurnMintTokenPool, "acceptOwnership", [], {
//     after: [
//       burnMintTokenPoolAddressTransaction,
//       BurnMintTokenPool,
//       registerTroken,
//     ],
//   });

//   // after:
//   //  - Deploy pool
//   //  - Register Token
//   // Accept admin role (Accept Admin Role) to TokenAdminRegistry
//   // with acceptAdminRole(address localToken)
//   const TokenAdminRegistry = m.contractAt(
//     "TokenAdminRegistry",
//     tokenAdminRegistry
//   );
//   const acceptAdminRole = m.call(
//     TokenAdminRegistry,
//     "acceptAdminRole",
//     [
//       // local token
//       BridgedSharesUnderAgreement,
//     ],
//     {
//       after: [
//         burnMintTokenPoolAddressTransaction,
//         BurnMintTokenPool,
//         registerTroken,
//       ],
//     }
//   );

//   // after:
//   //  - Register token
//   //  - Accept admin
//   //  - Accept pool ownership
//   // Register Pool (Set Pool) to TokenAdminRegistry
//   // with setPool(address localToken, address pool)
//   m.call(
//     TokenAdminRegistry,
//     "setPool",
//     [
//       // local token
//       BridgedSharesUnderAgreement,
//       // Deployed pool
//       BurnMintTokenPool,
//     ],
//     { after: [registerTroken, acceptAdminRole, acceptPoolOwnership] }
//   );

//   return {
//     BridgedSharesUnderAgreement,
//     BurnMintTokenPool,
//   };
// });
