import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const config = {
  factoryManagerAddress: "0x555E7852d4ab6F8C557F9Bc6d17ADdb8c7911d78"
}

const AktionariatFactoryUpdate0819Module = buildModule("AktionariatFactoryUpdate0819Module", (m) => {
  const backendOwner = m.getAccount(0);

  const factoryManager = m.contractAt("FactoryManager", config.factoryManagerAddress);
  const allowlistDraggableFactory = m.contract("AllowlistDraggableFactory", [backendOwner], { from: backendOwner });
  const tokenFactory = m.contract("TokenFactory", [backendOwner, allowlistDraggableFactory], { from: backendOwner });

  m.call(allowlistDraggableFactory, "setManager", [factoryManager], { from: backendOwner });
  m.call(tokenFactory, "setManager", [factoryManager], { from: backendOwner });

  return { 
    factoryManager,
    allowlistDraggableFactory,
    tokenFactory
   };
});

export default AktionariatFactoryUpdate0819Module;
