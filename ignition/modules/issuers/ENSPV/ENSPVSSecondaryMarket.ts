import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const config = {
  tradeReactorAddress: "0x4a67f44F48a887910525Dc8004ce804b99BC27cA",
  secondaryMarketFactoryAddress: "0x08C2cb730dC666Dd6487667B1D66BA9eF5Fe71D4",
  zchfAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
  backendRouterAddress: "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b",
  enspvsAddress: "0xE6f96DF2EF13f225bC7543350c1a8fF075777a02"
}

// (address owner, address currency, address token, address reactor, address router)

const ENSPVSSecondaryMarket251124Module = buildModule("ENSPVSSecondaryMarket251124Module", (m) => {
  // Transferred to multisig after deployment
  const backendOwner = m.getAccount(0);

  const secondaryMarketFactory = m.contractAt("SecondaryMarketFactory", config.secondaryMarketFactoryAddress);
  m.call(secondaryMarketFactory, "deploy", [backendOwner, config.zchfAddress, config.enspvsAddress, config.tradeReactorAddress, config.backendRouterAddress], { from: backendOwner });

  return { 
    secondaryMarketFactory
   };
});

export default ENSPVSSecondaryMarket251124Module;