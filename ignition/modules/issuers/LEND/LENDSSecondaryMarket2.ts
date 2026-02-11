import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const config = {
  tradeReactorAddress: "0x25ABF1feC6a89796e61107917b5C235557657ddD",
  secondaryMarketFactoryAddress: "0x08C2cb730dC666Dd6487667B1D66BA9eF5Fe71D4",
  zchfAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
  backendRouterAddress: "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b",
  lendsAddress: "0x343324F53CBEEE3Ee6d171f2a20F005964C98047",
  lendsMultisigOwner: "0x0af5512165975e76ee9425b0e3f3781bd17cad24"
}

const LENDSSecondaryMarket260211Module = buildModule("LENDSSecondaryMarket260211Module", (m) => {
  const backendOwner = m.getAccount(0);

  const secondaryMarketFactory = m.contractAt("SecondaryMarketFactory", config.secondaryMarketFactoryAddress);
  m.call(secondaryMarketFactory, "deploy", [config.lendsMultisigOwner, config.zchfAddress, config.lendsAddress, config.tradeReactorAddress, config.backendRouterAddress], { from: backendOwner });
  return { 
    secondaryMarketFactory
   };
});

export default LENDSSecondaryMarket260211Module;