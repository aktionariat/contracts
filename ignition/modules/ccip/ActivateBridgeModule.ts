/**
 * Ignition script to activate bridging to destination chains
 */
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ActivateBridgeModule", (m) => {
  const localTokenPool = m.getParameter<string>("localTokenPool");
  const remoteChainSelectors = m.getParameter<string[]>("remoteChainSelectors");

  const LocalTokenPool = m.contractAt("TokenPoolProxy", localTokenPool);

  m.call(LocalTokenPool, "activateChains", [remoteChainSelectors], {
    after: [LocalTokenPool],
  });
  return {};
});
