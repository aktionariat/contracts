import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const axrasAddress = "0xc02b55bB2Fe3643E1955b13515396cE23B110f80";

const AxrasCancelledModule = buildModule("AxrasCancelledModule", (m) => {
  const erc20Cancelled = m.contract("ERC20Cancelled", [axrasAddress]);

  return { 
    erc20Cancelled
   };
});

export default AxrasCancelledModule;
