const { task } = require("hardhat/config");
const Confirm = require('prompt-confirm');

const { ethers: { constants: { MaxUint256 }}} = require("ethers");

task("gas-price", "Prints gas price").setAction(async function({ address }, { ethers }) {
  console.log("Gas price", (await ethers.provider.getGasPrice()).toString())
})

task("bytecode", "Prints bytecode").setAction(async function({ address }, { ethers }) {
  console.log("Bytecode", await ethers.provider.getCode(address))
})

// simple create with defaults:
// yarn hardhat create-multisig-clone --salt <string_which_gets_formated_in_byte32>
task("create-multisig-clone", "Creates a multisig clone from the factory")
    .addOptionalParam("factory", "The contract addresse of the clone factory")
    .addOptionalParam("owner", "The owner address of the multisig")
    .addParam("salt", "The salt for the multsig")
    .setAction(async ({ factory, owner, salt }, { getNamedAccounts, ethers }) => {
        const { deployer, multiSigDefaultOwner } = await getNamedAccounts();
        if (factory == undefined) {
            switch   (network.name) {
                case "mainnet":
                    factory = "0xAA0cb4CA7aF641C7d046604Bb6AdFf0805f1dfbF"; // mainnet factory
                    break;
                case "kovan":
                    factory = "0xAF21E166ADc362465A27AeDc15315DcFc0c51624"; // kovan factory
                    break;
                case "ropsten":
                    factory = "0xd350a14834d0cFdfC40013A9b605Ecc9CA1024Ce" // ropsten factory
                    break;
                case "kovanOptimism":
                    factory = "0x1abD8b5194D733691D64c3F898300f88Ba0035d5" // optimism kovan factory
                    break;
                case "optimism":
                    factory = "0x12d57174b35D64Fc2798E7AA62F8379Bb49C2250" // optimism factory
                    break;
            }
        }
        if(owner == undefined) {
            owner = multiSigDefaultOwner;
        }

        multiSigCloneFactory = await ethers.getContractAt("MultiSigCloneFactory", factory);

        console.log("-----------------------")
        console.log("Deploy Multisig")
        console.log("-----------------------")
        console.log("deployer: %s", deployer);
        console.log("factory: %s", factory);
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
