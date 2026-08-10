/**
 * AddDestinationChainModule ignition script to modify source chain
 * contracts to add a chainlink CCIP chain destination
 */
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// TODO complete for testing

export default buildModule("AddRemoveDestinationChainModule", (m) => {
  // destination addresses
  const factorySource = m.getParameter<string>("factorySource");

  // source
  const remoteChainSelector = m.getParameter<bigint>("remotePoolsToRemove");
  const remotePoolAddress = m.getParameter<string>(
    "removeAddDestinationChains"
  );
  const remoteTokenAddress = m.getParameter<string>("remoteTokenAddress");

  // should check first if chain exists within pool, if so:
  //	-> use addRemotePool
  // else
  // 	-> use applyChainUpdates

  const FactorySource = m.contractAt("FactorySource", factorySource);
  m.call(FactorySource, "updateDestinationChains", [], {
    after: [FactorySource],
  });
  return {};
});
