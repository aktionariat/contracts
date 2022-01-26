const { task } = require("hardhat/config");
const Confirm = require('prompt-confirm');

const { ethers: { constants: { MaxUint256 }}} = require("ethers");

task("gas-price", "Prints gas price").setAction(async function({ address }, { ethers }) {
  console.log("Gas price", (await ethers.provider.getGasPrice()).toString())
})

task("bytecode", "Prints bytecode").setAction(async function({ address }, { ethers }) {
  console.log("Bytecode", await ethers.provider.getCode(address))
})

task("create-multisig-clone", "Creates a multisig clone from the factory")
    .addOptionalParam("factory", "The contract addresse of the clone factory")
    .addOptionalParam("owner", "The owner address of the multisig")
    .addParam("salt", "The salt for the multsig")
    .setAction(async ({ factory, owner, salt }, { getNamedAccounts, ethers }) => {
        const { deployer, multiSigDefaultOwner } = await getNamedAccounts();
        if (factory == undefined) {
            //factory = "0xb34E47DA0A612ffC5325790DD8e219D870f84898"; // mainnet factory
            factory = "0x140e1dD82C63a64E6BAE7635A83A049aa2c7290a"; // kovan factory
        }
        if(owner == undefined) {
            owner = multiSigDefaultOwner;
        }

        multiSigCloneFactory = await ethers.getContractAt("MultiSigCloneFactory", factory);

        console.log("-----------------------")
        console.log("Deploy Multisig")
        console.log("-----------------------")
        console.log("deployer: %s", deployer);
        console.log("owner: %s", owner)
        console.log("salt: %s", salt)

        if (network.name != "hardhat") {
            const prompt = await new Confirm("Addresses correct?").run();
            if(!prompt) {
                console.log("exiting");
                process.exit();
            }
        }

        const tx = await multiSigCloneFactory.create(owner, ethers.utils.formatBytes32String(salt), { gasLimit: 300000 });
        const { events } = await tx.wait();
        const { address } = events.find(Boolean);
        console.log(`MultiSig cloned at: ${address}`);
    })
