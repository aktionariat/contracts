const { task, subtask } = require("hardhat/config");
const Confirm = require('prompt-confirm');
const chalk = require('chalk');
const fs = require('fs-extra');
const inquirer  = require('./lib/inquirer');
const files = require('./lib/files');
const { getCompanyId, registerMultiSignature, registerToken, registerBrokerbot } = require("../scripts/register-helper");
const { ethers: { constants: { MaxUint256 }}} = require("ethers");
const { askReviewConfirm, askNetwork, askCompanySymbol, askWhatToRegister, askMultiSigAddress, askTokenAddress, askBrokrebotAddress, askBlockNumber, askBrokerbotAddress, askDeployConfig } = require("./lib/inquirer");
const {config} = require('./default_config.js');
const nconf = require('nconf');

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

task("initDeploy", "creates files for client deployment").setAction(async (taskArgs, hre) =>{
    console.log(config);
    fs.writeFileSync(config.deployConfig, "{}");
    nconf.add("deploy", {type: "file", file: config.deployConfig});
    nconf.set("multisigAddress", "0xC3F5c8Ba3E782679226ad252B837c9422e6b38Be");
    
    
    let networkName;
    if (network && network.name != "hardhat") {
        networkName = network.name;
    } else {
        networkName = await askNetwork();
    }
    nconf.set("network", networkName);
    /// set basecurrecny - right now only XCHF supported
    nconf.set("baseCurrencyAddress", networkName == "mainnet" ? config.xchf.mainnet : config.xchf.optimism);
    // get deployment config parameter
    let reviewCorrect;
    let deployConfig
    do {
        deployConfig = await askDeployConfig();
        displayDeployConfig(deployConfig);
        reviewCorrect = await askReviewConfirm();
    } while (!reviewCorrect)
    
    writeConfig(deployConfig);
    // deploy shares
    if ( deployConfig.allowlist ) {
        await hre.run("deploy", {
            tags: "AllowlistShares"+deployConfig.symbol,
            network: networkName
        });
    } else {
        await hre.run("deploy", {
            tags: "Shares"+deployConfig.symbol,
            network: networkName
        });
    }

    // deploy draggable
    if ( deployConfig.allowlist ) {
        await hre.run("deploy", {
            tags: "AllowlistDraggableShares"+deployConfig.symbol,
            network: networkName
        });
    } else {
        await hre.run("deploy", {
            tags: "DraggableShares"+deployConfig.symbol,
            network: networkName
        });
    }

    // deploy brokerbot
    await hre.run("deploy", {
        tags: "Brokerbot"+deployConfig.symbol,
        network: networkName
    });
    
    await hre.run("ttt");
    await askReviewConfirm()
    fs.unlinkSync(config.deployConfig);


    //const companySymbol = await askCompanySymbol();
    /*
    let pathTemplate;
    let pathDestination;
    switch (networkName) {
        case "mainnet":
            pathTemplate = "./deploy/example";
            pathDestination = `./deploy/${companySymbol}`;
            break;
        case "optimism":
            pathTemplate = "./deploy_optimism/example";
            pathDestination = `./deploy_optimism/${companySymbol}`;
            break;
        default:
            console.error("network not supported");
            process.exit();
    }
    */
})

task("ttt", "test").setAction(async (taskArgs, hre) => {
    console.log(nconf.stores);
})


task("companyId", "Gives back the company id")
    .addOptionalParam("name", "Name of the Company")
    .setAction(async ({name}) => {
        if(name == undefined ) {
            name = await inquirer.askCompanyName();
        }
        const companyNr = await getCompanyId(name)
        console.log(companyNr);
})

task("register", "Register contracts in the backend").setAction( async(taskArgs, hre) => {
    const networkName = await askNetwork();
    const registerChoices = await askWhatToRegister();
    const name = await inquirer.askCompanyName();
    const companyId = await getCompanyId(name);
    if( companyId == undefined ) {
        console.log(chalk.red("=== Company not found! - exiting ==="));
        process.exit();
    }
    if (registerChoices.includes('MultiSig')) {
        await hre.run("registerMultisig", {
            companyId: companyId.toString(),
            networkName: networkName
        })
    }
    if (registerChoices.includes('Token')) {
        await hre.run("registerToken", {
            companyId: companyId.toString(),
            networkName: networkName
        })
    }
    if (registerChoices.includes('Brokerbot')) {
        await hre.run("registerBrokerbot", {
            networkName: networkName
        })
    }
})

subtask("registerMultisig", "Registers the multisig address in the backend")
    .addOptionalParam("companyId", "Id of the company")
    .addOptionalParam("address", "The address of the multisignature")
    .addOptionalParam("networkName", "The blockchain network ")
    .setAction( async (taskArgs) => {
        console.log("============================");
        console.log("----- Register MultiSig ----");
        console.log("============================");
        let networkName = taskArgs.networkName;
        if (networkName == undefined) {
            const networkName = await askNetwork();
        }
        let companyId = taskArgs.companyId;
        if (companyId == undefined) {
            const name = await inquirer.askCompanyName();
            companyId = await getCompanyId(name);
        }
        let address = taskArgs.address;
        if (address == undefined) {
            address = await askMultiSigAddress();
        }
        let formattedAddress = formatAddress(taskArgs.networkName, address);
        await registerMultiSignature(companyId, formattedAddress);
        console.log(chalk.green(`=> MultiSignature Address(${formattedAddress}) registered succesfully.`));
})

subtask("registerToken", "Registers the token address in the backend")
    .addOptionalParam("companyId", "Id of the company")
    .addOptionalParam("address", "The address of the token")
    .addOptionalParam("networkName", "The blockchain network ")
    .addOptionalParam("blocknumber", "The block number at of the transaction of the deployment")
    .setAction( async (taskArgs) => {
        console.log("==========================");
        console.log("----- Register Token ----");
        console.log("==========================");
        let networkName = taskArgs.networkName;
        if (networkName == undefined) {
            const networkName = await askNetwork();
        }
        let companyId = taskArgs.companyId;
        if (companyId == undefined) {
            const name = await inquirer.askCompanyName();
            companyId = await getCompanyId(name);
        }
        let address = taskArgs.address;
        if (address == undefined) {
            address = await askTokenAddress();
        }
        let blocknumber = taskArgs.blocknumber;
        if (blocknumber == undefined) {
            blocknumber = await askBlockNumber();
        }
        let formattedAddress = formatAddress(taskArgs.networkName, address);
        await registerToken(companyId, formattedAddress, blocknumber.toString());
        console.log(chalk.green(`=> Token Address(${formattedAddress}) registered succesfully.`));
})
subtask("registerBrokerbot", "Registers the brokerbot address in the backend")
    .addOptionalParam("address", "The address of the token")
    .addOptionalParam("networkName", "The blockchain network ")
    .setAction( async (taskArgs) => {
        console.log("=============================");
        console.log("----- Register Brokerbot ----");
        console.log("=============================");
        let networkName = taskArgs.networkName;
        if (networkName == undefined) {
            const networkName = await askNetwork();
        }
        let address = taskArgs.address;
        if (address == undefined) {
            address = await askBrokerbotAddress();
        }
        let formattedAddress = formatAddress(taskArgs.networkName, address);
        await registerBrokerbot(formattedAddress);
        console.log(chalk.green(`=> Brokerbot Address(${formattedAddress}) registered succesfully.`));
})


function formatAddress (networkName, address) {
    let formattedAddress;
    switch (networkName) {
        case "mainnet":
            formattedAddress = "mainnet-"+address;
            break;
        case "optimism":
            formattedAddress = "optimism-"+address;
            break;
        default:
            console.log(`${networkName} not supported`);
            process.exit();
    }
    return formattedAddress;
}

function writeConfig(deployConfig) {
    nconf.set('symbol', deployConfig.symbol);
    nconf.set('name', deployConfig.shareName);
    nconf.set('terms', deployConfig.terms);
    nconf.set('totalShares', deployConfig.totalNumber);
    nconf.set('sharePrice', ethers.utils.parseEther(deployConfig.price).toString());
    nconf.set('increment', ethers.utils.parseEther(deployConfig.increment).toString());
    nconf.set('quorumBps', deployConfig.quorum*100);
    nconf.set('votePeriodSeconds', deployConfig.votePeriod*24*60*60);
    nconf.set('Allowlist', deployConfig.allowlist);
    nconf.set('Draggable', deployConfig.draggable);
    nconf.save();
}

function displayDeployConfig(deployConfig) {
    console.log("=============================");
    console.log("==== Review Deploy Config ===");
    console.log("=============================");
    console.log(`Symbol: ${deployConfig.symbol}`);
    console.log(`Name: ${deployConfig.shareName}`);
    console.log(`Terms: ${deployConfig.terms}`);
    console.log(`Number of Shares: ${deployConfig.totalNumber}`);
    console.log(`Price per Shares: ${deployConfig.price}`);
    console.log(`Increment: ${deployConfig.increment}`);
    console.log(`Quorum (%): ${deployConfig.quorum}`);
    console.log(`Voting Period (days): ${deployConfig.votePeriod}`);
    console.log(`Allowlist: ${deployConfig.allowlist}`);
    console.log(`Draggable: ${deployConfig.draggable}`);
    console.log("=============================");
}