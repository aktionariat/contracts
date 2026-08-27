import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("BridgedSHAModule", (m) => {
  const owner = m.getAccount(0);

  const SYMBOL = m.getParameter("SYMBOL", "bMSTR");
  const NAME = m.getParameter("NAME", "Bridged Microstrategy Shares");
  const TERMS = m.getParameter("TERMS", "Bridged T&C");

  // Deploy Bridged token
  const BridgedSharesUnderAgreement = m.contract(
    "BridgedSharesUnderAgreement",
    [SYMBOL, NAME, TERMS, owner]
  );

  return {
    BridgedSharesUnderAgreement,
  };
});
