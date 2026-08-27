/**
 * DestinationFactoryModule
 *
 * Deploys the TokenDeploymentManagerDestination (the destination-chain
 * deployment manager), wired to the destination logic sub-factories.
 */
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("DestinationFactoryModule", (m) => {
  const bridgedSHAFactory = m.getParameter<string>("bridgedSHAFactory");
  const burnMintTokenPoolFactory = m.getParameter<string>(
    "burnMintTokenPoolFactory"
  );

  const FactoryDestination = m.contract("TokenDeploymentManagerDestination", [
    bridgedSHAFactory,
    burnMintTokenPoolFactory,
  ]);

  return {
    FactoryDestination,
  };
});