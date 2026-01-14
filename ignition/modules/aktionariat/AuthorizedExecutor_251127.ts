import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AuthorizedExecutor251127Module = buildModule("AuthorizedExecutor251127Module", (m) => {
  const backendOwner = m.getAccount(0);

  const authorizedExecutor = m.contract("AuthorizedExecutor", [], { from: backendOwner });

  return { 
    authorizedExecutor
   };
});

export default AuthorizedExecutor251127Module;
