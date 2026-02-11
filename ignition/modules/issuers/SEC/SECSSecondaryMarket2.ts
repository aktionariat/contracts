import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const config = {
  tradeReactorAddress: "0x25ABF1feC6a89796e61107917b5C235557657ddD",
  secondaryMarketFactoryAddress: "0x08C2cb730dC666Dd6487667B1D66BA9eF5Fe71D4",
  zchfAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
  backendRouterAddress: "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b",
  secsAddress: "0xea391f908cc394795ee9c2e94ebadc4a1b5d861b",
  secsMultisigOwner: "0x0ab9345ff4fbddcbfc6f31ab8a4d4cd06adece39"
}

const SECSSecondaryMarket260211Module = buildModule("SECSSecondaryMarket260211Module", (m) => {
  const backendOwner = m.getAccount(0);

  const secondaryMarketFactory = m.contractAt("SecondaryMarketFactory", config.secondaryMarketFactoryAddress);
  m.call(secondaryMarketFactory, "deploy", [config.secsMultisigOwner, config.zchfAddress, config.secsAddress, config.tradeReactorAddress, config.backendRouterAddress], { from: backendOwner });

  return { 
    secondaryMarketFactory
   };
});

export default SECSSecondaryMarket260211Module;
