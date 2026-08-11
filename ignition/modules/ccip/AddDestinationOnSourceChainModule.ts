/**
 * AddRemoveDestinationChainModule ignition script to remove and add
 * destination chains to a source chain token pool through FactorySource
 */
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AddRemoveDestinationChainModule", (m) => {
  // TokenPool on the source chain
  const tokenPool = m.getParameter<string>("tokenPool");

  // source chain token pool and destinations to be removed and added
  const poolAddress = m.getParameter<bigint[]>("remoteChainSelectorsToRemove");
  const chainsToAdd = m.getParameter<bigint[]>("chainsToAdd");

  const TokenPool = m.contractAt("FactorySource", tokenPool);

  m.call(TokenPool, "applyChainUpdates", [poolAddress, chainsToAdd], {
    after: [TokenPool],
  });
  return {};
});
