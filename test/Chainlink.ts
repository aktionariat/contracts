// Chainlink CCIP infrastructure on the forked chains, read from the forks on 2026-09-30, and minimal ABIs for the
// pools, lockbox, registry and router (the pool artifacts are not emitted for node_modules sources).

export const MAINNET_SELECTOR = 5009297550715157269n;
export const POLYGON_SELECTOR = 4051577828743386545n;

export const CHAINLINK_MAINNET = {
  router: "0x80226fc0ee2b096224eeac085bb9a8cba1146f7d",
  rmnProxy: "0x411de17f12d1a34ecc7f45f49844626267c75e81",
  tokenAdminRegistry: "0xb22764f98dd05c789929716d677382df22c05cb6",
  registryModule: "0x4855174e9479e211337832e109e7721d43a4ca64", // RegistryModuleOwnerCustom 1.6.0
};

export const CHAINLINK_POLYGON = {
  router: "0x849c5ed5a80f5b408dd4969b78c2c8fdf0565bfe",
  rmnProxy: "0xf1ceaa46d8d13cac9fc38aaef3d3d14754c5a9c2",
  tokenAdminRegistry: "0x00f027ea6d0fb03256a15e9182b2b9227a4931d8",
  registryModule: "0xc751e86208f0f8af2d5cd0e29716ca7ad98b5ef5", // RegistryModuleOwnerCustom 1.6.0
};

const RATE_LIMIT = "tuple(bool isEnabled, uint128 capacity, uint128 rate)";
const CHAIN_UPDATE = `tuple(uint64 remoteChainSelector, bytes[] remotePoolAddresses, bytes remoteTokenAddress, ${RATE_LIMIT} outboundRateLimiterConfig, ${RATE_LIMIT} inboundRateLimiterConfig)`;

export const POOL_ABI = [
  "function owner() view returns (address)",
  "function acceptOwnership()",
  "function transferOwnership(address)",
  "function typeAndVersion() view returns (string)",
  "function getToken() view returns (address)",
  "function getDynamicConfig() view returns (address router, address rateLimitAdmin, address feeAdmin)",
  "function getRmnProxy() view returns (address)",
  "function getRemotePools(uint64) view returns (bytes[])",
  "function getRemoteToken(uint64) view returns (bytes)",
  `function applyChainUpdates(uint64[] remove, ${CHAIN_UPDATE}[] add)`,
  "function lockOrBurn(tuple(bytes receiver, uint64 remoteChainSelector, address originalSender, uint256 amount, address localToken) input) returns (tuple(bytes destTokenAddress, bytes destPoolData))",
  "function releaseOrMint(tuple(bytes originalSender, uint64 remoteChainSelector, address receiver, uint256 sourceDenominatedAmount, address localToken, bytes sourcePoolAddress, bytes sourcePoolData, bytes offchainTokenData) input) returns (tuple(uint256 destinationAmount))",
  "error CallerIsNotARampOnRouter(address)",
  "error InvalidSourcePoolAddress(bytes)",
];

export const LOCKBOX_ABI = [
  "function owner() view returns (address)",
  "function acceptOwnership()",
  "function getToken() view returns (address)",
  "function getAllAuthorizedCallers() view returns (address[])",
];

export const REGISTRY_ABI = [
  "function getPool(address) view returns (address)",
  "function getTokenConfig(address) view returns (tuple(address administrator, address pendingAdministrator, address tokenPool))",
];

export const ROUTER_ABI = [
  "function getOnRamp(uint64) view returns (address)",
  "function getOffRamps() view returns (tuple(uint64 sourceChainSelector, address offRamp)[])",
];

export const NO_RATE_LIMIT = { isEnabled: false, capacity: 0n, rate: 0n };

// The chain update a pool owner applies to reach a remote pool and token.
export function chainUpdate(abiCoder: any, selector: bigint, remotePool: string, remoteToken: string) {
  return {
    remoteChainSelector: selector,
    remotePoolAddresses: [abiCoder.encode(["address"], [remotePool])],
    remoteTokenAddress: abiCoder.encode(["address"], [remoteToken]),
    outboundRateLimiterConfig: NO_RATE_LIMIT,
    inboundRateLimiterConfig: NO_RATE_LIMIT,
  };
}
