/**
 * ResetDestinationChainModule ignition script to reset source
 * token pool destination chain settings
 */
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ChainUpdateRuntimeValue } from "./lib/types.ts";

export default buildModule("ResetDestinationChainModule", (m) => {
  // destination addresses
  const localTokenPool = m.getParameter<string>("localTokenPool");

  // source
  const remoteChainSelector = m.getParameter<bigint>("remoteChainSelector");
  const remotePoolAddress = m.getParameter<string>("remotePoolAddress");
  const remoteTokenAddress = m.getParameter<string>("remoteTokenAddress");

  const LocalTokenPool = m.contractAt("TokenPool", localTokenPool);
  const chainUpdate: ChainUpdateRuntimeValue = {
    remoteChainSelector,
    remotePoolAddresses: [remotePoolAddress],
    remoteTokenAddress,
    outboundRateLimiterConfig: {
      isEnabled: false,
      capacity: 0n,
      rate: 0n,
    },
    inboundRateLimiterConfig: {
      isEnabled: false,
      capacity: 0n,
      rate: 0n,
    },
  };
  m.call(
    LocalTokenPool,
    "applyChainUpdates",
    [
      // remove chain first
      // uint64[] calldata remoteChainSelectorsToRemove
      [remoteChainSelector],
      // apply updates later
      // ChainUpdate[] calldata chainsToAdd
      [chainUpdate],
    ],
    {
      after: [LocalTokenPool],
    }
  );
  return {};
});
