import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AcceptOwnershipAfterFactoryModule", (m) => {
  const tokenPool = m.getParameter<string>("tokenPool");
  const localTokenAdminRegistry = m.getParameter<string>(
    "localTokenAdminRegistry"
  );
  const localToken = m.getParameter<string>("localToken");

  const TokenPool = m.contractAt("TokenPool", tokenPool);
  const TokenAdminRegistry = m.contractAt(
    "TokenAdminRegistry",
    localTokenAdminRegistry
  );

  m.call(TokenPool, "acceptOwnership", [], {
    after: [TokenPool],
  });

  m.call(TokenAdminRegistry, "acceptAdminRole", [localToken], {
    after: [TokenPool, TokenAdminRegistry],
  });

  return {};
});
