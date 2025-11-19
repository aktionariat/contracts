import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const config = {
  tradeReactorAddress: "0x4a67f44F48a887910525Dc8004ce804b99BC27cA",
  zchfAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
  backendRouterAddress: "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b",
  secAddress: "0xA5C24de2a2b1de1298CE6D369EEDaffFD6B5f009",
  secsAddress: "0xEa391F908CC394795EE9c2e94EBaDc4A1B5D861B"
}

// (address owner, address currency, address token, address reactor, address router)

const AktionariatSecondaryMarket1119Module = buildModule("AktionariatSecondaryMarket1119Module", (m) => {
  const backendOwner = m.getAccount(0);

  const secondaryMarketFactory = m.contract("SecondaryMarketFactory", []);
  m.call(secondaryMarketFactory, "deploy", [backendOwner, config.zchfAddress, config.secsAddress, config.tradeReactorAddress, config.backendRouterAddress], { from: backendOwner });

  return { 
    secondaryMarketFactory
   };
});

export default AktionariatSecondaryMarket1119Module;
