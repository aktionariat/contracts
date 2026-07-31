/**
 * AddDestinationChainModule ignition script to modify source chain
 * contracts to add a chainlink CCIP chain destination
 */
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ChainUpdate } from "./lib/types.ts";

export default buildModule("AddDestinationChainModule", (m) => {
  // destination addresses
  const localTokenPool = m.getParameter<string>("localTokenPool");

  // source
  const remoteChainSelector = m.getParameter<bigint>("remoteChainSelector");
  const remotePoolAddress = m.getParameter<string>("remotePoolAddress");
  const remoteTokenAddress = m.getParameter<string>("remoteTokenAddress");

  // should check first if chain exists within pool, if so:
  //	-> use addRemotePool
  // else
  // 	-> use applyChainUpdates

  const LocalTokenPool = m.contractAt("TokenPool", localTokenPool);
  //   // uint64 remoteChainSelector,
  //   // bytes calldata remotePoolAddress
  //   m.call(
  //     LocalTokenPool,
  //     "addRemotePool",
  //     [remoteChainSelector, remotePoolAddress],
  //     {
  //       after: [LocalTokenPool],
  //     }
  //   );

  //   struct ChainUpdate {
  //     uint64 remoteChainSelector; // Remote chain selector
  //     bytes[] remotePoolAddresses; // Address of the remote pool, ABI encoded in the case of a remote EVM chain.
  //     bytes remoteTokenAddress; // Address of the remote token, ABI encoded in the case of a remote EVM chain.
  //     RateLimiter.Config outboundRateLimiterConfig; // Outbound rate limited config, meaning the rate limits for all of the onRamps for the given chain
  //     RateLimiter.Config inboundRateLimiterConfig; // Inbound rate limited config, meaning the rate limits for all of the offRamps for the given chain
  //   }

  // for now straight up call
  // uint64[] calldata remoteChainSelectorsToRemove,
  // ChainUpdate[] calldata chainsToAdd
  const chainUpdate: ChainUpdate = {
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
  m.call(LocalTokenPool, "applyChainUpdates", [[], [chainUpdate]], {
    after: [LocalTokenPool],
  });
  return {};
});
