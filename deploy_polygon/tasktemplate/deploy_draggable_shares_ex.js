const Confirm = require('prompt-confirm');
const nconf = require('nconf');
const { getGasPrice } = require('../../scripts/helper/polygongasstation.js');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const owner = nconf.get("multisigAddress");
  const symbol = nconf.get("symbol");
  const shares = await deployments.get(symbol+"Shares");
  // const recoveryHub = await deployments.get("RecoveryHub");
  // const offerFactory = await deployments.get("OfferFactory");
  // nconf.set("address:recoveryHub", await recoveryHub.getAddress());
  // nconf.set("address:offerFactory", await offerFactory.getAddress())
  // nconf.set("address:permit2Hub", await permit2Hub.getAddress());
  const recoveryHub = await ethers.getContractAt("RecoveryHub", nconf.get("address:recoveryHub"));
  const offerFactory = await await ethers.getContractAt("OfferFactory", nconf.get("address:offerFactory"));
  const permit2Hub = await ethers.getContractAt("Permit2Hub", nconf.get("address:permit2Hub"));
  
  const terms = nconf.get("terms");
  const quorumBps = nconf.get("quorumBps");
  const quorumMigration = nconf.get("quorumMigration");
  const votePeriodSeconds = nconf.get("votePeriodSeconds");

  const params = {
    wrappedToken: shares.address,
    quorumDrag: quorumBps,
    quorumMigration: quorumMigration,
    votePeriod: votePeriodSeconds
  }
  
  if (network.name != "hardhat" && !nconf.get("silent")) {
    console.log("-----------------------");
    console.log("Deploy DraggableShares " + symbol);
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("shares: %s", shares.address);
    console.log("recoveryHub: %s", await recoveryHub.getAddress());
    console.log("offer factory: %s", await offerFactory.getAddress());
    console.log("permit2hub: %s", await permit2Hub.getAddress());
    console.log("owner: %s", owner); // don't forget to set it in deploy_config.js as the multsigadr

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  // const feeData = await ethers.provider.getFeeData();
  const feeData = await getGasPrice();

  const { address, receipt } = await deploy(symbol+"DraggableShares", {
    contract: "DraggableShares",
    from: deployer,
    args: [
      terms,
      params,
      await recoveryHub.getAddress(),
      await offerFactory.getAddress(),
      owner,
      await permit2Hub.getAddress()
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
  const draggableContract = await ethers.getContract(symbol+"DraggableShares");
  const version = await draggableContract.VERSION();

  // set config
  nconf.set("brokerbot:shares", address);
  nconf.set("address:draggable", address);
  nconf.set("blocknumber", receipt.blockNumber.toString());
  nconf.set("version:draggable", version.toString());
};

module.exports.tags = [nconf.get("symbol")+"DraggableShares"];
module.exports.dependencies = [nconf.get("symbol")+"Shares", "RecoveryHub", "OfferFactory"];