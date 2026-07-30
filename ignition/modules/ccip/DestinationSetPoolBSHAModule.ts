/**
 * SourceChainModule ignition script to deploy source chain contracts
 * and connect to chainlink CCIP from a yet to be connected source
 * token
 */

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("DestinationSetPool", (m) => {
  // local addresses
  const localToken = m.getParameter<string>("localToken");
  const localTokenPool = m.getParameter<string>("localTokenPool");

  const BridgedSharesUnderAgreement = m.contractAt(
    "BridgedSharesUnderAgreement",
    localToken
  );
  m.call(BridgedSharesUnderAgreement, "setPool", [localTokenPool], {
    after: [BridgedSharesUnderAgreement],
  });

  return {};
});
