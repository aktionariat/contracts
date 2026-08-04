/**
 * SourceFactoryModule
 *
 * maybe I can coalesce it into one, single factory
 */
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("SourceFactoryModule", (m) => {
  const FactorySource = m.contract("CCIPFactorySource");
  return { FactorySource };
});
