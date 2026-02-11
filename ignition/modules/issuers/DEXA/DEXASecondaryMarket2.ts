import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const config = {
  tradeReactorAddress: "0x699B77B40bEF9eBA25C39B480c20c38cF7AbaD81",
  secondaryMarketFactoryAddress: "0x08C2cb730dC666Dd6487667B1D66BA9eF5Fe71D4",
  zchfAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
  backendRouterAddress: "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b",
  dexaAddress: "0xbf0e13ab37573abb68ff9c33ee9ff8148b8a61e2",
  dexaMultisigOwner: "0xb8020d1656cadab89f9d3ad638c4015b6b705143"
}

const DEXASecondaryMarket260211Module = buildModule("DEXASecondaryMarket260211Module", (m) => {
  const backendOwner = m.getAccount(0);

  const secondaryMarketFactory = m.contractAt("SecondaryMarketFactory", config.secondaryMarketFactoryAddress);
  m.call(secondaryMarketFactory, "deploy", [config.dexaMultisigOwner, config.zchfAddress, config.dexaAddress, config.tradeReactorAddress, config.backendRouterAddress], { from: backendOwner });

  return { 
    secondaryMarketFactory
   };
});

export default DEXASecondaryMarket260211Module;