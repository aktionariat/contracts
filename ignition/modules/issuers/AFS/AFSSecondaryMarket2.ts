import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const config = {
  tradeReactorAddress: "0x699B77B40bEF9eBA25C39B480c20c38cF7AbaD81",
  secondaryMarketFactoryAddress: "0x08C2cb730dC666Dd6487667B1D66BA9eF5Fe71D4",
  zchfAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
  backendRouterAddress: "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b",
  afsAddress: "0x56528C1dF17FD5451451eB6EFDE297758bc8f9a1",
  afsMultisigOwner: "0x4d307525b22897ca07af7e34079397f3d7ae60a2"
}

const AFSSecondaryMarket260211Module = buildModule("AFSSecondaryMarket260211Module", (m) => {
  const backendOwner = m.getAccount(0);

  const secondaryMarketFactory = m.contractAt("SecondaryMarketFactory", config.secondaryMarketFactoryAddress);
  m.call(secondaryMarketFactory, "deploy", [config.afsMultisigOwner, config.zchfAddress, config.afsAddress, config.tradeReactorAddress, config.backendRouterAddress], { from: backendOwner });
  return { 
    secondaryMarketFactory
   };
});

export default AFSSecondaryMarket260211Module;