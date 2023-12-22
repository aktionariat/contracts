const Confirm = require('prompt-confirm');
const nconf = require('nconf');

module.exports = async function ({ ethers, deployments, getNamedAccounts, network }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  const deployerSigner = await ethers.getSigner(deployer);

  const owner = nconf.get("multisigAddress");

  const sharesAddress = nconf.get("brokerbot:shares")
  //const paymentHub = await deployments.get("PaymentHub");
  const paymentHub = await ethers.getContractAt("PaymentHub", "0x7e08078AdCcBFda94daf16184FBfa50acBdEb848");
  nconf.set("address:paymentHub", paymentHub.address);
  
  const price = nconf.get("sharePrice");
  const increment = nconf.get("increment");
  const baseCurrencyContract = nconf.get("baseCurrencyAddress");
  
  
  if (network.name != "hardhat"&& !nconf.get("silent")) {
    console.log("-----------------------");
    console.log("Deploy Brokerbot " + nconf.get("symbol"));
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("shares: %s", sharesAddress);
    console.log("paymentHub: %s", paymentHub.address);
    console.log("base xchf: %s", baseCurrencyContract);
    console.log("owner: %s", owner);  // don't forget to set it in deploy_config.js as the multsigadr

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy(nconf.get("symbol")+"Brokerbot", {
    contract: "Brokerbot",
    from: deployer,
    args: [
      sharesAddress,
      price,
      increment,
      baseCurrencyContract,
      owner,
      paymentHub.address],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
  const brokerbotContract = await ethers.getContract(nconf.get("symbol")+"Brokerbot");
  const version = await brokerbotContract.VERSION();
  
  // register brokerbot at registry
  brokerbotRegistry = await ethers.getContractAt("BrokerbotRegistry", "0x2C9b9b9143A9Ef5051A299EF3CC8039b06927093"); // is fix (change will mess up subgrpah)
  const prompt = await new Confirm("Register brokerbot?").run();
  if(prompt) {
    await brokerbotRegistry.connect(deployerSigner).registerBrokerbot(address, baseCurrencyContract, sharesAddress, { gasLimit: 50000});
  }
  
  //set config
  nconf.set("address:brokerbot", address);
  nconf.set("address:brokerbotRegistry", brokerbotRegistry.address);
  nconf.set("version:brokerbot", version.toString());
};


module.exports.tags = [nconf.get("symbol")+"Brokerbot"];
//module.exports.dependencies = ["PaymentHub"];
