/**
 * SourceChainModule ignition script to deploy source chain contracts
 * and connect to chainlink CCIP from a yet to be connected source
 * token
 */

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("SourceChainModule", (m) => {
  // source addresses
  const sharesUnderAgreement = m.getParameter<string>("sharesUnderAgreement");
  const lockReleaseTokenPool = m.getParameter<string>("lockReleaseTokenPool");
  const registryModuleOwner = m.getParameter<string>("registryModuleOwner");
  const tokenAdminRegistry = m.getParameter<string>("tokenAdminRegistry");

  // can't wait for call to end and return address by lockReleaseTokenPoolAddressTransaction
  // can't call getPool from TokenPoolFactory as we have to manually set it later
  // can't predict it directly in the ignition script because of futures
  // possibilities:
  //  - deply beforehand
  //  - predict it within task and pass address
  //  - write wrapper within CCIPSender that makes all deployment actions at once in solidity
  //    instead of making them here, or just the token pool deployment and saves the address
  //    within a local ds

  // after:
  //  - Deploy pool
  // accept pool ownership to POOL_ADDRESS with acceptOwnership()
  const LockReleaseTokenPool = m.contractAt(
    "LockReleaseTokenPool",
    lockReleaseTokenPool
  );
  m.call(LockReleaseTokenPool, "acceptOwnership", [], {
    after: [LockReleaseTokenPool],
  });

  // after:
  //  - Deploy pool
  // Register token (Register Admin via Owner) to RegistryModuleOwnerCustom
  // with registerAdminViaOwner(address token)
  const RegistryModuleOwner = m.contractAt(
    "RegistryModuleOwnerCustom",
    registryModuleOwner
  );
  m.call(RegistryModuleOwner, "registerAdminViaOwner", [
    // token
    sharesUnderAgreement,
  ]);

  // after:
  //  - Deploy pool
  // Accept admin role (Accept Admin Role) to 0x95F29FEE11c5C55d26cCcf1DB6772DE953B37B82
  // with acceptAdminRole(address localToken)
  const TokenAdminRegistry = m.contractAt(
    "TokenAdminRegistry",
    tokenAdminRegistry
  );
  m.call(TokenAdminRegistry, "acceptAdminRole", [
    // local token
    sharesUnderAgreement,
  ]);

  // after:
  //  - Register token
  //  - Accept admin
  //  - Accept pool ownership
  // register pool (Set Pool) to 0x95F29FEE11c5C55d26cCcf1DB6772DE953B37B82 with setPool(address localToken, address pool)
  m.call(TokenAdminRegistry, "setPool", [
    // local token
    sharesUnderAgreement,
    // Deployed pool
    LockReleaseTokenPool,
  ]);
  return {};
});
