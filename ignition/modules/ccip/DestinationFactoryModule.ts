/**
 * DestinationFactoryModule
 */
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("DestinationFactoryModule", (m) => {
  const FactoryDestination = m.contract("CCIPFactoryDestination");
  return { FactoryDestination };
});
