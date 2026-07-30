/**
 * SourceChainModule ignition script to deploy source chain contracts
 * and connect to chainlink CCIP from a yet to be connected source
 * token
 */

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ChainSettingsModule", (m) => {
  // source addresses
  const localToken = m.getParameter<string>("localToken");
  const localTokenPool = m.getParameter<string>("localTokenPool");
  const localRegistryModuleOwner = m.getParameter<string>(
    "localRegistryModuleOwner"
  );
  const localTokenAdminRegistry = m.getParameter<string>(
    "localTokenAdminRegistry"
  );

  // after:
  //  - Deploy pool -> Done before calling module
  // Accept pool ownership to TokenPool (should inherit IOwnable)
  // with acceptOwnership()
  const LocalTokenPool = m.contractAt("IOwnable", localTokenPool);
  m.call(LocalTokenPool, "acceptOwnership", [], {
    after: [LocalTokenPool],
  });

  // after:
  //  - Deploy pool -> Done before calling module
  // Register token (Register Admin via Owner) to RegistryModuleOwnerCustom
  // with registerAdminViaOwner(address token)
  const LocalRegistryModuleOwner = m.contractAt(
    "RegistryModuleOwnerCustom",
    localRegistryModuleOwner
  );
  const registerAdminViaOwner = m.call(
    LocalRegistryModuleOwner,
    "registerAdminViaOwner",
    [
      // token
      localToken,
    ],
    { after: [LocalRegistryModuleOwner] }
  );

  // after:
  //  - Deploy pool -> Done before calling module
  //  - Register token
  // Accept admin role (Accept Admin Role) to TokenAdminRegistry
  // with acceptAdminRole(address localToken)
  const LocalTokenAdminRegistry = m.contractAt(
    "TokenAdminRegistry",
    localTokenAdminRegistry
  );
  const acceptAdminRole = m.call(
    LocalTokenAdminRegistry,
    "acceptAdminRole",
    [
      // local token
      localToken,
    ],
    {
      after: [LocalTokenAdminRegistry, registerAdminViaOwner],
    }
  );

  // after:
  //  - Accept admin
  // register pool (Set Pool) to TokenAdminRegistry
  // with setPool(address localToken, address pool)
  m.call(
    LocalTokenAdminRegistry,
    "setPool",
    [
      // local token
      localToken,
      // Deployed pool
      localTokenPool,
    ],
    {
      after: [LocalTokenAdminRegistry, acceptAdminRole],
    }
  );
  return {};
});
