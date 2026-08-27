/**
 * SourceFactoryModule
 *
 * Deploys the TokenDeploymentManagerSource (the source-chain deployment
 * manager), wired to the source logic sub-factories.
 */
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("SourceFactoryModule", (m) => {
  const sharesFactory = m.getParameter<string>("sharesFactory");
  const shaFactory = m.getParameter<string>("shaFactory");
  const lockReleaseTokenPoolFactory = m.getParameter<string>(
    "lockReleaseTokenPoolFactory"
  );

  const FactorySource = m.contract("TokenDeploymentManagerSource", [
    sharesFactory,
    shaFactory,
    lockReleaseTokenPoolFactory,
  ]);

  return {
    FactorySource,
  };
});