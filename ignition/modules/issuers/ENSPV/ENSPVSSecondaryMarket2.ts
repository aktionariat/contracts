import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const config = {
  tradeReactorAddress: "0x699B77B40bEF9eBA25C39B480c20c38cF7AbaD81",
  secondaryMarketFactoryAddress: "0x08C2cb730dC666Dd6487667B1D66BA9eF5Fe71D4",
  zchfAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
  backendRouterAddress: "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b",
  enspvsAddress: "0xE6f96DF2EF13f225bC7543350c1a8fF075777a02",
  enspvsMultisigOwner: "0xb802b54f8c8a16e68cf136bdd556d949710614e7"
}

// (address owner, address currency, address token, address reactor, address router)

const ENSPVSSecondaryMarket260211Module = buildModule("ENSPVSSecondaryMarket260211Module", (m) => {
  // Transferred to multisig after deployment
  const backendOwner = m.getAccount(0);

  const secondaryMarketFactory = m.contractAt("SecondaryMarketFactory", config.secondaryMarketFactoryAddress);
  m.call(secondaryMarketFactory, "deploy", [config.enspvsMultisigOwner, config.zchfAddress, config.enspvsAddress, config.tradeReactorAddress, config.backendRouterAddress], { from: backendOwner });

  return { 
    secondaryMarketFactory
   };
});

export default ENSPVSSecondaryMarket260211Module;