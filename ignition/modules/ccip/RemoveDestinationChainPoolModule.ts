/**
 * AddDestinationChainModule ignition script to modify source chain
 * contracts to add a chainlink CCIP chain destination
 */
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("RemoveDestinationChainModule", (m) => {
  // destination addresses
  const localTokenPool = m.getParameter<string>("localTokenPool");

  // source
  const remoteChainSelector = m.getParameter<bigint>("remoteChainSelector");
  // note it is bytes: has to be msb padded until 32 bytes
  const remotePoolAddress = m.getParameter<string>("remotePoolAddress");

  // should check first if chain exists within pool, if so:
  //	-> use addRemotePool
  // else
  // -> use applyChainUpdates

  const LocalTokenPool = m.contractAt("TokenPool", localTokenPool);
  m.call(
    LocalTokenPool,
    "removeRemotePool",
    [remoteChainSelector, remotePoolAddress],
    {
      after: [LocalTokenPool],
    }
  );
  return {};
});
