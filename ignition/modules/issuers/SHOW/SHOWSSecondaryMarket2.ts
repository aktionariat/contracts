import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const config = {
  tradeReactorAddress: "0x25ABF1feC6a89796e61107917b5C235557657ddD",
  secondaryMarketFactoryAddress: "0x08C2cb730dC666Dd6487667B1D66BA9eF5Fe71D4",
  zchfAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
  backendRouterAddress: "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b",
  showsAddress: "0xf9af4c818521d1878699aa0ede6cddcffd0cf958",
  showsMultisigOwner: "0xb40b89e4efef694d5f7c82e3a7cec72c718e1ddc"
}

// (address owner, address currency, address token, address reactor, address router)

const SHOWSSecondaryMarket260211Module = buildModule("SHOWSSecondaryMarket260211Module", (m) => {
  const backendOwner = m.getAccount(0);

  const secondaryMarketFactory = m.contractAt("SecondaryMarketFactory", config.secondaryMarketFactoryAddress);
  m.call(secondaryMarketFactory, "deploy", [config.showsMultisigOwner, config.zchfAddress, config.showsAddress, config.tradeReactorAddress, config.backendRouterAddress], { from: backendOwner });

  return { 
    secondaryMarketFactory
   };
});

export default SHOWSSecondaryMarket260211Module;