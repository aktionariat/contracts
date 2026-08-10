/**
 * Ignition script to halt bridging to destination chains
 */
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("HaltBridgeModule", (m) => {
  const localTokenPool = m.getParameter<string>("localTokenPool");
  const remoteChainSelectors = m.getParameter<bigint[]>("remoteChainSelectors");

  const LocalTokenPool = m.contractAt("TokenPoolProxy", localTokenPool);

  m.call(LocalTokenPool, "haltChains", [remoteChainSelectors], {
    after: [LocalTokenPool],
  });
  return {};
});
