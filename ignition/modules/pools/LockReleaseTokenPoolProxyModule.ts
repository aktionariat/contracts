import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LockReleaseTokenPoolProxyModule", (m) => {
  const token = m.getParameter<string>("token");
  const localTokenDecimals = m.getParameter<number>("localTokenDecimals");
  const allowlist = m.getParameter<string[]>("allowlist");
  const rmnProxy = m.getParameter<string>("rmnProxy");
  const acceptLiquidity = m.getParameter<boolean>("acceptLiquidity");
  const router = m.getParameter<string>("router");

  // LockReleaseTokenPoolProxy
  // IERC20 token,
  // uint8 localTokenDecimals,
  // address[] memory allowlist,
  // address rmnProxy,
  // bool acceptLiquidity,
  // address router
  const LockReleaseTokenPoolProxy = m.contract("LockReleaseTokenPoolProxy", [
    token,
    localTokenDecimals,
    allowlist,
    rmnProxy,
    acceptLiquidity,
    router,
  ]);

  return {
    LockReleaseTokenPoolProxy,
  };
});
