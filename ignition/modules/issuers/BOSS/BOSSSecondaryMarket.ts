import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const config = {
  multisigOwner: "0xc63186e1edd8621c5b63d1ffaedd1182ee1572b0",
  tradeReactorAddress: "0x4a67f44F48a887910525Dc8004ce804b99BC27cA",
  secondaryMarketFactoryAddress: "0x08C2cb730dC666Dd6487667B1D66BA9eF5Fe71D4",
  zchfAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
  backendRouterAddress: "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b",
  bossAddress: "0x2e880962a9609aa3eab4def919fe9e917e99073b"
}

const BOSSSecondaryMarket260119Module = buildModule("BOSSSecondaryMarket260119Module", (m) => {
  const backendOwner = m.getAccount(0);

  const secondaryMarketFactory = m.contractAt("SecondaryMarketFactory", config.secondaryMarketFactoryAddress);
  m.call(secondaryMarketFactory, "deploy", [config.multisigOwner, config.zchfAddress, config.bossAddress, config.tradeReactorAddress, config.backendRouterAddress], { from: backendOwner });
  return { 
    secondaryMarketFactory
   };
});

export default BOSSSecondaryMarket260119Module;