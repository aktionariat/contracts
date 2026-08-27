import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { DestinationChainlinkAddresses } from "../lib/types.ts";

/**
 * Deploys the destination-chain logic sub-factories that the
 * TokenDeploymentManagerDestination uses to deploy BridgedSharesUnderAgreement
 * and the BurnMintTokenPool.
 *
 * Each logic factory holds the creation bytecode of its target contract
 * (and, for the pool, the Chainlink infrastructure addresses) immutably.
 */
export default buildModule("LogicsDestinationModule", (m) => {
  const bridgedSHABytecode = m.getParameter<string>("bridgedSHABytecode");
  const burnMintTokenPoolBytecode = m.getParameter<string>(
    "burnMintTokenPoolBytecode"
  );
  const chainlinkAddresses = m.getParameter<DestinationChainlinkAddresses>(
    "chainlinkAddresses"
  );

  const bridgedSHAFactory = m.contract("BridgedSHAFactory", [
    bridgedSHABytecode,
  ]);
  const burnMintTokenPoolFactory = m.contract("CCIPBurnMintTokenPoolFactory", [
    burnMintTokenPoolBytecode,
    chainlinkAddresses,
  ]);

  return {
    bridgedSHAFactory,
    burnMintTokenPoolFactory,
  };
});