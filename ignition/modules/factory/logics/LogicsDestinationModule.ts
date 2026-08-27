import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { DestinationChainlinkAddresses } from "../lib/types.ts";

/**
 * Deploys the destination-chain logic sub-factories that the
 * TokenDeploymentManagerDestination uses to deploy BridgedSharesUnderAgreement
 * and the BurnMintTokenPool.
 *
 * Each logic factory derives its target's creation bytecode from an import
 * (`type(Target).creationCode`); only the Chainlink infrastructure addresses
 * are passed in.
 */
export default buildModule("LogicsDestinationModule", (m) => {
  const chainlinkAddresses = m.getParameter<DestinationChainlinkAddresses>(
    "chainlinkAddresses"
  );

  const bridgedSHAFactory = m.contract("BridgedSHAFactory", []);
  const burnMintTokenPoolFactory = m.contract("CCIPBurnMintTokenPoolFactory", [
    chainlinkAddresses,
  ]);

  return {
    bridgedSHAFactory,
    burnMintTokenPoolFactory,
  };
});