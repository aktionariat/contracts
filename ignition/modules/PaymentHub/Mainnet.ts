import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const config = {
  uniswapQuoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
  uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
};

const PaymentHubMainnetModule = buildModule("PaymentHubMainnetModule", (m) => {
  const paymentHub = m.contract("PaymentHub", [
    config.uniswapQuoter,
    config.uniswapRouter,
  ]);

  return { paymentHub };
});

export default PaymentHubMainnetModule;
