const { task, subtask } = require("hardhat/config");
const Confirm = require('prompt-confirm');
const chalk = require('chalk');
const simpleGit = require("simple-git");
const fs = require('fs-extra');
const inquirer  = require('./lib/inquirer');
const files = require('./lib/files');
const { getCompanyId, registerMultiSignature, registerToken, registerBrokerbot } = require("../scripts/register-helper");
const { ethers: { constants: { MaxUint256 }}} = require("ethers");
const {
    askReviewConfirm,
    askNetwork, 
    askCompanySymbol, 
    askWhatToRegister, 
    askMultiSigAddress, 
    askTokenAddress, 
    askBrokrebotAddress, 
    askBlockNumber, 
    askBrokerbotAddress, 
    askDeployConfig,
    askConfirmWithMsg,
    askPrice,
    askIncrement,
    askCompanyName
 } = require("./lib/inquirer");
const {config} = require('./default_config.js');
const nconf = require('nconf');
const git = simpleGit();

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
        const deployerSigner = await ethers.getSigner(deployer);
        if (factory == undefined) {
            switch   (network.name) {
                case "mainnet":
                    factory = "0x9C6471DC5B5BC216a74fC37056042256fd5E95B3"; // mainnet factory V4
                    break;
                case "kovan":
                    factory = "0xAF21E166ADc362465A27AeDc15315DcFc0c51624"; // kovan factory
                    break;
                case "goerli":
                    factory = "0x1776C349696CccAE06541542C5ED954CDf9859cC"; // goerli factory
                    break;
                case "ropsten":
                    factory = "0xd350a14834d0cFdfC40013A9b605Ecc9CA1024Ce" // ropsten factory
                    break;
                case "kovanOptimism":
                    factory = "0x1abD8b5194D733691D64c3F898300f88Ba0035d5" // optimism kovan factory
                    break;
                case "optimism":
                    factory = "0xaE52FDaaDEbfe4D943546d3f60640Ba6959B8fcb" // optimism factory
                    break;
            }
        }
        if(owner == undefined) {
            owner = multiSigDefaultOwner;
        }

        multiSigCloneFactory = await ethers.getContractAt("MultiSigCloneFactory.sol:MultiSigCloneFactory", factory);

        if (network.name != "hardhat" && !nconf.get("silent")) {
            console.log("-----------------------")
            console.log("Deploy Multisig")
            console.log("-----------------------")
            console.log("deployer: %s", deployer);
            console.log("factory: %s", factory);
            console.log("owner: %s", owner)
            console.log("salt: %s", salt)

            const prompt = await new Confirm("Addresses correct?").run();
            if(!prompt) {
                console.log("exiting");
                process.exit();
            }
        }

        const tx = await multiSigCloneFactory.connect(deployerSigner).create(owner, ethers.utils.formatBytes32String(salt), { gasLimit: 300000 });
        console.log(`deploying MultiSigWallet Clone (tx: ${tx.hash}) with Nonce: ${tx.nonce}`);
        const { events } = await tx.wait();
        const { address } = events.find(Boolean);
        console.log(`MultiSig cloned at: ${address}`);

        nconf.set("multisigAddress", address);
})

task("init-deploy", "creates files for client deployment")
    .addOptionalParam("silent", "Silence log to minimum")
    .setAction(async (taskArgs, hre) =>{
    console.log("=================================================")
    console.log("============ AKTIONARIAT DEPLOYER ===============")
    console.log("=================================================")
    if (! network || network.name == "hardhat") {
        hre.changeNetwork(await askNetwork());
    }
    await switchToBranch(network.name);
    // get deployment config parameter
    let reviewCorrect;
    let deployConfig
    do {
        deployConfig = await askDeployConfig();
        displayDeployConfig(deployConfig);
        reviewCorrect = await askConfirmWithMsg("Are the values correct?");
    } while (!reviewCorrect)

    // create deploy log
    if(!files.directoryExists(config.deployLogDir)) {
        files.createDirectory(config.deployLogDir)
    }
    fs.writeFileSync(`${config.deployLogDir}/${deployConfig.symbol}.json`, "{}");
    nconf.add("deploy", {type: "file", file: `${config.deployLogDir}/${deployConfig.symbol}.json`});

    // set config
    if (taskArgs.silent) {
        nconf.set("silent", true);
    }

    nconf.set("network", network.name);
    setBaseCurrency();
    writeConfig(deployConfig);

    // deploy multisig
    const newMultisig = await askConfirmWithMsg("Do you want to deploy a new multisig wallet?");
    if (newMultisig){
        await hre.run("create-multisig-clone", {
            salt: deployConfig.symbol,
            owner: nconf.get("multisigSigner"),
        })
    } else {
        const existingMultisig = await askMultiSigAddress();
        nconf.set("multisigAddress", existingMultisig);
    }

    // deploy shares
    if ( deployConfig.allowlist ) {
        await hre.run("deploy", {
            tags: deployConfig.symbol+"AllowlistShares",
        });
    } else {
        await hre.run("deploy", {
            tags: deployConfig.symbol+"Shares",
        });
    }

    // deploy draggable
    if ( deployConfig.draggable ) {
        if ( deployConfig.allowlist ) {
            await hre.run("deploy", {
                tags: deployConfig.symbol+"AllowlistDraggableShares",
            });
        } else {
            await hre.run("deploy", {
                tags: deployConfig.symbol+"DraggableShares",
            });
        }
    }

    // deploy brokerbot
    await hre.run("deploy", {
        tags: deployConfig.symbol+"Brokerbot",
    });

    
    // write deploy log
    nconf.save();
    await readDeployValues();
    
    // verify on etherscan
    const verify = await askConfirmWithMsg("Do you want to verify on etherscan?");
    if (network.name != "hardhat" && verify) {
        await hre.run("etherscan-verify", {
        license: "None"
        });
    }

    // register at the backend
    const doRegister = await askConfirmWithMsg("Do you want to register the contracts in the back-end?");
    if (network.name != "hardhat" && doRegister) {
        await hre.run("register", {
            choices: "MultiSig Token Brokerbot",
            name: nconf.get("companyName"),
            tokenAddress: nconf.get("brokerbot:shares"),
            multisigAddress: nconf.get("multisigAddress"),
            brokerbotAddress: nconf.get("address:brokerbot"),
            blocknumber: nconf.get("blocknumber")
        });
    }
})

task("deploy-brokerbot", "Deploy a new brokerbot")
    .addOptionalParam("owner", "Owner of the brokerbot (generally a multisig)")
    .addOptionalParam("tokenAddress", "Share token address")
    .addOptionalParam("baseAddress", "Base token addresse")
    .addOptionalParam("price", "Inital Price")
    .addOptionalParam("increment", "Price increment")
    .setAction(async (taskArgs, hre) => {
        console.log("=================================================")
        console.log("============ DEPLOY BROKERBOT ===================")
        console.log("=================================================")
        if (! network || network.name == "hardhat") {
            hre.changeNetwork(await askNetwork());
        }
        await switchToBranch(network.name);
        // get deployment config parameter
        let reviewCorrect;
        let deployConfig;
        do {
            let companyName = await askCompanyName();
            let owner = taskArgs.owner;
            if(owner == undefined){
                owner = await askMultiSigAddress();
            }
            let tokenAddress = taskArgs.tokenAddress;
            if(tokenAddress == undefined){
                tokenAddress = await askTokenAddress();
            }
            let price = taskArgs.price;
            if(price == undefined){
                price = await askPrice();
            }
            let increment = taskArgs.increment;
            if(increment == undefined){
                increment = await askIncrement();
            }
            deployConfig = {companyName, owner, tokenAddress, price, increment};
            displayDeployBrokerbotConfig(deployConfig);
            reviewCorrect = await askConfirmWithMsg("Are the values correct?");
        } while (!reviewCorrect)
        console.log(deployConfig);

        // create deploy log
        if(!files.directoryExists(config.deployLogDir)) {
            files.createDirectory(config.deployLogDir)
        }
        fs.writeFileSync(`${config.deployLogDir}/${deployConfig.companyName}-NewBrokerbot.json`, "{}");
        nconf.add("deploy", {type: "file", file: `${config.deployLogDir}/${deployConfig.companyName}-NewBrokerbot.json`});
        nconf.set("network", network.name);
        setBaseCurrency();
        // write nconf
        writeBrokerbotConfig(deployConfig);
        console.log(nconf.get("multisigAddress"));
        // deploy brokerbot
        await hre.run("deploy", {
            tags: deployConfig.companyName+"Brokerbot",
        });
    });

task("companyId", "Gives back the company id")
    .addOptionalParam("name", "Name of the Company")
    .setAction(async ({name}) => {
        if(name == undefined ) {
            name = await inquirer.askCompanyName();
        }
        const companyNr = await getCompanyId(name)
        console.log(companyNr);
})

task("register", "Register contracts in the backend")
    .addOptionalParam("choices", "List of contracts types to register")
    .addOptionalParam("name", "The company name")
    .addOptionalParam("tokenAddress", "The (draggable)share address")
    .addOptionalParam("multisigAddress", "The multisig address")
    .addOptionalParam("brokerbotAddress", "The brokerbot address")
    .addOptionalParam("blocknumber", "The blocknumber the shares got deployed")
    .setAction( async(taskArgs, hre) => {
    if (! network || network.name == "hardhat") {
        hre.changeNetwork(await askNetwork());
    }
    let registerChoices;
    if (taskArgs.choices) {
        registerChoices = taskArgs.choices.split(" ");
    } else {
        registerChoices = await askWhatToRegister();
    }
    let name;
    if (taskArgs.name) {
        name = taskArgs.name;
    } else {
        name = await inquirer.askCompanyName();
    }   
    const companyId = await getCompanyId(name);
    if( companyId == undefined ) {
        console.log(chalk.red("=== Company not found! - exiting ==="));
        process.exit();
    }
    if (registerChoices.includes('MultiSig')) {
        await hre.run("registerMultisig", {
            companyId: companyId.toString(),
            address: taskArgs.multisigAddress
        })
    }
    if (registerChoices.includes('Token')) {
        await hre.run("registerToken", {
            companyId: companyId.toString(),
            address: taskArgs.tokenAddress,
            blocknumber: taskArgs.blocknumber
        })
    }
    if (registerChoices.includes('Brokerbot')) {
        await hre.run("registerBrokerbot", {
            address: taskArgs.brokerbotAddress
        })
    }
})

subtask("registerMultisig", "Registers the multisig address in the backend")
    .addOptionalParam("companyId", "Id of the company")
    .addOptionalParam("address", "The address of the multisignature")
    .setAction( async (taskArgs) => {
        console.log("============================");
        console.log("----- Register MultiSig ----");
        console.log("============================");
        if (! network || network.name == "hardhat") {
            hre.changeNetwork(await askNetwork());
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
        let formattedAddress = formatAddress(network.name, address);
        await registerMultiSignature(companyId, formattedAddress);
        console.log(chalk.green(`=> MultiSignature Address(${formattedAddress}) registered succesfully.`));
})

subtask("registerToken", "Registers the token address in the backend")
    .addOptionalParam("companyId", "Id of the company")
    .addOptionalParam("address", "The address of the token")
    .addOptionalParam("blocknumber", "The block number at of the transaction of the deployment")
    .setAction( async (taskArgs) => {
        console.log("==========================");
        console.log("----- Register Token ----");
        console.log("==========================");
        if (! network || network.name == "hardhat") {
            hre.changeNetwork(await askNetwork());
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
        let formattedAddress = formatAddress(network.name, address);
        await registerToken(companyId, formattedAddress, blocknumber.toString());
        console.log(chalk.green(`=> Token Address(${formattedAddress}) registered succesfully.`));
})
subtask("registerBrokerbot", "Registers the brokerbot address in the backend")
    .addOptionalParam("address", "The address of the token")
    .setAction( async (taskArgs) => {
        console.log("=============================");
        console.log("----- Register Brokerbot ----");
        console.log("=============================");
        if (! network || network.name == "hardhat") {
            hre.changeNetwork(await askNetwork());
        }
        let address = taskArgs.address;
        if (address == undefined) {
            address = await askBrokerbotAddress();
        }
        let formattedAddress = formatAddress(network.name, address);
        await registerBrokerbot(formattedAddress);
        console.log(chalk.green(`=> Brokerbot Address(${formattedAddress}) registered succesfully.`));
})

task("deploy-multisig-batch", "deploys multiple multisigs at once")
    .setAction( async(taskArgs, hre) => {
        nconf.use('memory');
        nconf.set("silent", true);
        const firstSigner = "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b";
        for (let index = 0; index < 22; index++) {            
            let saltName = "fixv2"+index
            await hre.run("create-multisig-clone", {
                salt: saltName,
                owner: firstSigner,
            })
        }
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
    nconf.set("companyName", deployConfig.companyName);
    nconf.set("multisigSigner", deployConfig.multisigSigner);
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

function writeBrokerbotConfig(deployConfig) {
    nconf.set("symbol", deployConfig.companyName);
    nconf.set("multisigAddress", deployConfig.owner);
    nconf.set("brokerbot:shares", deployConfig.tokenAddress);
    nconf.set('sharePrice', ethers.utils.parseEther(deployConfig.price).toString());
    nconf.set('increment', ethers.utils.parseEther(deployConfig.increment).toString());
    nconf.save();
}

function displayDeployConfig(deployConfig) {
    console.log("=============================");
    console.log("==== Review Deploy Config ===");
    console.log("=============================");
    console.log(`Company Name: ${deployConfig.companyName}`);
    console.log(`First Signer: ${deployConfig.multisigSigner}`);
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

function displayDeployBrokerbotConfig(deployConfig) {
    console.log("======================================");
    console.log("==== Review DeployBrokerbot Config ===");
    console.log("======================================");
    console.log(`Owner: ${deployConfig.owner}`);
    console.log(`(Draggable)Share Token: ${deployConfig.tokenAddress}`);
    console.log(`Base Currency: ${deployConfig.baseAddress}`);
    console.log(`Price per Shares: ${deployConfig.price}`);
    console.log(`Increment: ${deployConfig.increment}`);
    console.log("=============================");
}

function setBaseCurrency() {
    const networkName = nconf.get("network");
    // set basecurrecny - right now only XCHF supported
    // TODO: switches for test nets
    console.log(`networkname: ${networkName}`);
    switch (networkName) {
        case "mainnet":
            nconf.set("baseCurrencyAddress", config.xchf.mainnet);
            break;
        case "optimsim":
            nconf.set("baseCurrencyAddress", config.xchf.optimism);
            break;
        case "goerli":
            nconf.set("baseCurrencyAddress", config.xchf.goerli);
            break;
        case "sepolia":
            nconf.set("baseCurrencyAddress", config.xchf.sepolia);
            break;
        default:
            nconf.set("baseCurrencyAddress", config.xchf.mainnet);
            break;
    }
    //nconf.set("baseCurrencyAddress", networkName == "mainnet" ? config.xchf.mainnet : config.xchf.optimism);
}

async function switchToBranch(networkName) {
    switch (networkName) {
        case "optimism":
            await git.checkout("op-deploy-template");
            break;
        case "goerliOptimism":
            await git.checkout("op-deploy-template");
            break;
        default:
            await git.checkout("deployment-template")
            break;
    }
}

async function readDeployValues() {
    const shares = await ethers.getContractAt("Shares", nconf.get("Allowlist") ? nconf.get("address:allowlist:shares") : nconf.get("address:share"));
    const draggable = await ethers.getContractAt("DraggableShares", nconf.get("Allowlist") ? nconf.get("address:allowlist:draggable") : nconf.get("address:draggable"));
    const brokerbot = await ethers.getContractAt("Brokerbot", nconf.get("address:brokerbot"));
    console.log("=============================================================")
    console.log("===== Deployment Finished with following on-chain data ======")
    console.log("=============================================================")
    console.log("Draggable named: %s", await draggable.name());
    console.log("Draggable symbol: %s", await draggable.symbol());
    console.log("draggable terms: %s", await draggable.terms());
    console.log("draggable quorum: %s", await draggable.quorum());
    console.log("Draggable oracle: %s", await draggable.oracle());
    console.log("Share version: %s", await shares.VERSION());
    console.log("Brokerbot version: %s", await brokerbot.VERSION());
    console.log("Brokerbot base: %s", await brokerbot.base());
    console.log("Brokerbot token: %s", await brokerbot.token());
}
