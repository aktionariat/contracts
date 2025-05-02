import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const config = {
  factoryManagerAddress: "0x555E7852d4ab6F8C557F9Bc6d17ADdb8c7911d78",
  brokerbotFactory: "0xfAe70dEBb64a7176aaA41D1d7fEAfc4CCA4a5107",
}

const AktionariatFactoryUpdate0525Module = buildModule("AktionariatFactoryUpdate0525Module", (m) => {
  const backendOwner = m.getAccount(0);

  const factoryManager = m.contractAt("FactoryManager", config.factoryManagerAddress);
  const allowlistDraggableFactory = m.contract("AllowlistDraggableFactory", [backendOwner], { from: backendOwner });
  const tokenFactory = m.contract("TokenFactory", [backendOwner, allowlistDraggableFactory], { from: backendOwner });
  const aktionariatFactory = m.contract("AktionariatFactory", [backendOwner], { from: backendOwner });

  m.call(allowlistDraggableFactory, "setManager", [factoryManager], { from: backendOwner });
  m.call(tokenFactory, "setManager", [factoryManager], { from: backendOwner });
  m.call(aktionariatFactory, "setManager", [factoryManager], { from: backendOwner });
  m.call(aktionariatFactory, "setBrokerbotFactory", [config.brokerbotFactory], { from: backendOwner });
  m.call(aktionariatFactory, "setTokenFactory", [tokenFactory], { from: backendOwner });

  return { 
    factoryManager,
    allowlistDraggableFactory,
    tokenFactory,
    aktionariatFactory
   };
});

export default AktionariatFactoryUpdate0525Module;
