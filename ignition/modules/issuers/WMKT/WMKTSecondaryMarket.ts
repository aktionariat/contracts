import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const config = {
  tradeReactorAddress: "0x699B77B40bEF9eBA25C39B480c20c38cF7AbaD81",
  secondaryMarketFactoryAddress: "0x08C2cb730dC666Dd6487667B1D66BA9eF5Fe71D4",
  zchfAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
  backendRouterAddress: "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b",
  wmktAddress: "0xc95506540268b0447663efbfffd71b51fe92ea7f",
  wmktMultisigOwner: "0x6404a242e794afa894804fdbda19217a1fdf2dfe"
}

const WMKTSecondaryMarket260305Module = buildModule("WMKTSecondaryMarket260305Module", (m) => {
  const backendOwner = m.getAccount(0);

  const secondaryMarketFactory = m.contractAt("SecondaryMarketFactory", config.secondaryMarketFactoryAddress);
  m.call(secondaryMarketFactory, "deploy", [config.wmktMultisigOwner, config.zchfAddress, config.wmktAddress, config.tradeReactorAddress, config.backendRouterAddress], { from: backendOwner });

  return { 
    secondaryMarketFactory
   };
});

export default WMKTSecondaryMarket260305Module;