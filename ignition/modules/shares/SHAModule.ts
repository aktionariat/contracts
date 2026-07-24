import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("SHAModule", (m) => {
  // we get accounts: [...] first entry configured in hardhat.config.ts
  const owner = m.getAccount(0);

  const SYMBOL = m.getParameter("SYMBOL", "MSTR");
  const NAME = m.getParameter("NAME", "Microstrategy Shares");
  const TERMS = m.getParameter("TERMS", "T&C");

  // string memory _symbol,
  // string memory _name,
  // string memory _terms,
  // address _owner
  const Shares = m.contract("Shares", [SYMBOL, NAME, TERMS, owner]);

  const decimals = m.staticCall(Shares, "decimals");

  // IERC20 base_,
  // string memory _terms,
  // uint8 _decimals,
  // address _owner
  const SharesUnderAgreement = m.contract("SharesUnderAgreement", [
    Shares,
    TERMS,
    decimals,
    owner,
  ]);

  return {
    Shares,
    SharesUnderAgreement,
  };
});
