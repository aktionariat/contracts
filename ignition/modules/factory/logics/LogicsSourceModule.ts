import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { SourceChainlinkAddresses } from "../lib/types.ts";

/**
 * Deploys the source-chain logic sub-factories that the
 * TokenDeploymentManagerSource uses to deploy Shares, SharesUnderAgreement and
 * the LockReleaseTokenPool.
 *
 * Each logic factory holds the creation bytecode of its target contract
 * (and, for the pool, the Chainlink infrastructure addresses) immutably.
 */
export default buildModule("LogicsSourceModule", (m) => {
  const sharesBytecode = m.getParameter<string>("sharesBytecode");
  const shaBytecode = m.getParameter<string>("shaBytecode");
  const lockReleaseTokenPoolBytecode = m.getParameter<string>(
    "lockReleaseTokenPoolBytecode"
  );
  const chainlinkAddresses = m.getParameter<SourceChainlinkAddresses>(
    "chainlinkAddresses"
  );

  const sharesFactory = m.contract("SharesFactory", [sharesBytecode]);
  const shaFactory = m.contract("SHAFactory", [shaBytecode]);
  const lockReleaseTokenPoolFactory = m.contract(
    "CCIPLockReleaseTokenPoolFactory",
    [lockReleaseTokenPoolBytecode, chainlinkAddresses]
  );

  return {
    sharesFactory,
    shaFactory,
    lockReleaseTokenPoolFactory,
  };
});