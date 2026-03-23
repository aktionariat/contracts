import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const config = {
  tradeReactorAddress: "0x699B77B40bEF9eBA25C39B480c20c38cF7AbaD81",
  secondaryMarketFactoryAddress: "0x08C2cb730dC666Dd6487667B1D66BA9eF5Fe71D4",
  zchfAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
  backendRouterAddress: "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b",
  pdsAddress: "0xa995d67fd0187b4b8fea3a60e11f31a08e4ac40b",
  pdsMultisigOwner: "0xc72429381fa2b499ef8e7f61e3343b813a61d539"
}

const PDSSecondaryMarket260319Module = buildModule("PDSSecondaryMarket260319Module", (m) => {
  const backendOwner = m.getAccount(0);

  const secondaryMarketFactory = m.contractAt("SecondaryMarketFactory", config.secondaryMarketFactoryAddress);
  m.call(secondaryMarketFactory, "deploy", [config.pdsMultisigOwner, config.zchfAddress, config.pdsAddress, config.tradeReactorAddress, config.backendRouterAddress], { from: backendOwner });
  return { 
    secondaryMarketFactory
   };
});

export default PDSSecondaryMarket260319Module;