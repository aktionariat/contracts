const { task } = require("hardhat/config");

const { ethers: { constants: { MaxUint256 }}} = require("ethers");

task("gas-price", "Prints gas price").setAction(async function({ address }, { ethers }) {
  console.log("Gas price", (await ethers.provider.getGasPrice()).toString())
})

task("bytecode", "Prints bytecode").setAction(async function({ address }, { ethers }) {
  console.log("Bytecode", await ethers.provider.getCode(address))
})

task("create-multisig-clone", "Creates a multisig clone from the factory")
  .addParam("factory", "The contract addresse of the clone factory")
  .addParam("owner", "The owner address of the multisig")
  .addParam("salt", "The salt for the multsig")
  .setAction(async ({ factory, owner, salt }, { getNamedAccounts, ethers }) => {
    multiSigCloneFactory = await ethers.getContractAt("MultiSigCloneFactory", factory);
    const tx2 = await multiSigCloneFactory.create(owner, ethers.utils.formatBytes32String(salt));
    const { events } = await tx2.wait();
    const { address } = events.find(Boolean);
    console.log(`MultiSig cloned at: ${address}`);
  })
