import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("BurnMintTokenPoolProxyModule", (m) => {
  const token = m.getParameter<string>("token");
  const localTokenDecimals = m.getParameter<number>("localTokenDecimals");
  const allowlist = m.getParameter<string[]>("allowlist");
  const rmnProxy = m.getParameter<string>("rmnProxy");
  const router = m.getParameter<string>("router");

  // BurnMintTokenPoolProxy
  // IERC20 token,
  // uint8 localTokenDecimals,
  // address[] memory allowlist,
  // address rmnProxy,
  // address router
  const BurnMintTokenPoolProxy = m.contract("BurnMintTokenPoolProxy", [
    token,
    localTokenDecimals,
    allowlist,
    rmnProxy,
    router,
  ]);

  return {
    BurnMintTokenPoolProxy,
  };
});
