/**
 * DestinationFactoryModule
 */
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("DestinationFactoryModule", (m) => {
  const bshaLogicContract = m.getParameter<string>("bshaLogicContract");
  const tokenPoolLogicContract = m.getParameter<string>(
    "tokenPoolLogicContract"
  );

  const FactoryDestination = m.contract("FactoryDestination", [
    bshaLogicContract,
    tokenPoolLogicContract,
  ]);

  const sourceWrapper = m.readEventArgument(
    FactoryDestination,
    "BridgedSharesUnderAgreementLogicResolved",
    "sourceWrapper"
  );

  const sourcePool = m.readEventArgument(
    FactoryDestination,
    "TokenPoolLogicResolved",
    "sourcePool"
  );

  return {
    FactoryDestination,
    BridgedSharesUnderAgreementLogic: m.contractAt(
      "BridgedSharesUnderAgreement",
      sourceWrapper
    ),
    TokenPoolLogic: m.contractAt("BurnMintTokenPool", sourcePool),
  };
});
