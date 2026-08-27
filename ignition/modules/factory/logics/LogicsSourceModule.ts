import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { SourceChainlinkAddresses } from "../lib/types.ts";

/**
 * Deploys the source-chain logic sub-factories that the
 * TokenDeploymentManagerSource uses to deploy Shares, SharesUnderAgreement and
 * the LockReleaseTokenPool.
 *
 * Each logic factory derives its target's creation bytecode from an import
 * (`type(Target).creationCode`); only the Chainlink infrastructure addresses
 * are passed in.
 */
export default buildModule("LogicsSourceModule", (m) => {
  const chainlinkAddresses = m.getParameter<SourceChainlinkAddresses>(
    "chainlinkAddresses"
  );

  const sharesFactory = m.contract("SharesFactory", []);
  const shaFactory = m.contract("SHAFactory", []);
  const lockReleaseTokenPoolFactory = m.contract(
    "CCIPLockReleaseTokenPoolFactory",
    [chainlinkAddresses]
  );

  return {
    sharesFactory,
    shaFactory,
    lockReleaseTokenPoolFactory,
  };
});