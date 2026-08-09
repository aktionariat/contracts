/**
 * SourceFactoryModule
 */
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("SourceFactoryModule", (m) => {
  const sharesLogicContract = m.getParameter<string>("sharesLogicContract");
  const shaLogicContract = m.getParameter<string>("shaLogicContract");
  const tokenPoolLogicContract = m.getParameter<string>(
    "tokenPoolLogicContract"
  );

  const FactorySource = m.contract("FactorySource", [
    sharesLogicContract,
    shaLogicContract,
    tokenPoolLogicContract,
  ]);

  const sourceToken = m.readEventArgument(
    FactorySource,
    "SharesLogicResolved",
    "sourceToken"
  );
  const sourceWrapper = m.readEventArgument(
    FactorySource,
    "SharesUnderAgreementLogicResolved",
    "sourceWrapper"
  );
  const sourcePool = m.readEventArgument(
    FactorySource,
    "TokenPoolLogicResolved",
    "sourcePool"
  );

  return {
    FactorySource,
    SharesLogic: m.contractAt("Shares", sourceToken),
    SharesUnderAgreementLogic: m.contractAt(
      "SharesUnderAgreement",
      sourceWrapper
    ),
    TokenPoolLogic: m.contractAt("LockReleaseTokenPool", sourcePool),
  };
});
