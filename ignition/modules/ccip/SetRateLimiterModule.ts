/**
 * SetRateLimiterModule ignition script to set rate
 * limiting for both inbound and outbound lanes of
 * multiple destination chains.
 *
 * From source TokenPool uses:
 *
 * /// @notice Sets multiple chain rate limiter configs.
 * /// @param remoteChainSelectors The remote chain selector for which the rate limits apply.
 * /// @param outboundConfigs The new outbound rate limiter config, meaning the onRamp rate limits for the given chain.
 * /// @param inboundConfigs The new inbound rate limiter config, meaning the offRamp rate limits for the given chain.
 * function setChainRateLimiterConfigs(
 * uint64[] calldata remoteChainSelectors,
 * RateLimiter.Config[] calldata outboundConfigs,
 * RateLimiter.Config[] calldata inboundConfigs
 * ) external
 *
 */
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { RateLimiterConfigSolidityParameter } from "./lib/types.ts";

export default buildModule("SetRateLimiterModule", (m) => {
  const localTokenPool = m.getParameter<string>("localTokenPool");

  const remoteChainSelectors = m.getParameter<bigint[]>("remoteChainSelectors");
  const outboundConfig =
    m.getParameter<RateLimiterConfigSolidityParameter[]>("outboundConfig");
  const inboundConfigs =
    m.getParameter<RateLimiterConfigSolidityParameter[]>("inboundConfigs");

  const tokenPool = m.contractAt("TokenPool", localTokenPool);

  m.call(tokenPool, "setChainRateLimiterConfigs", [
    remoteChainSelectors,
    outboundConfig,
    inboundConfigs,
  ]);

  return {};
});
