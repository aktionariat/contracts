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
            factory = "0xAA0cb4CA7aF641C7d046604Bb6AdFf0805f1dfbF"; // mainnet factory
            //factory = "0xAF21E166ADc362465A27AeDc15315DcFc0c51624"; // kovan factory
            // factory = "0xd350a14834d0cFdfC40013A9b605Ecc9CA1024Ce" // ropsten factory
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
        console.log("factory: %s", factory)

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
