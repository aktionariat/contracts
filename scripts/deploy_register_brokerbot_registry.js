const {network, ethers, deployments } = require("hardhat");
const Confirm = require('prompt-confirm');

async function main() {

  const [deployer] = await ethers.getSigners();
  const baseCurrencyAddress = "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08";

  const { deploy } = deployments;
    
  if (network.name != "hardhat") {
    console.log("-----------------------")
    console.log("Deploy Brokerbot Registry")
    console.log("-----------------------")
    console.log("deployer: %s", deployer.address);
    console.log("owner: %s", deployer.address); 

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("BrokerbotRegistry", {
    contract: "BrokerbotRegistry",
    from: deployer.address,
    args: [
      deployer.address],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });

  let brokerbotRegistry = await ethers.getContractAt("BrokerbotRegistry", address);
  //console.log(brokerbotRegistry);

  // register brokerbots
  const daksBrokerbot = "0xbddE35780e3986a47e54a580017d8213f0D2bB84";
  const daksShare = "0xbddE35780e3986a47e54a580017d8213f0D2bB84";
  console.log("register daks");
  await brokerbotRegistry.registerBrokerbot(daksBrokerbot, baseCurrencyAddress, daksShare);

  console.log("register green");
  const greenBrokerbot = "0xFA1A2e457484aD9b991c035e718ee23d45049428";
  const greenShare = "0x4E1A609eC87cF6477613F515F6eB64eF2D31089a";
  await brokerbotRegistry.registerBrokerbot(greenBrokerbot, baseCurrencyAddress, greenShare);

  console.log("register quitt");
  const quittBrokrebot = "0x1abD8b5194D733691D64c3F898300f88Ba0035d5";
  const quittShare = "0x8747a3114Ef7f0eEBd3eB337F745E31dBF81a952";
  await brokerbotRegistry.registerBrokerbot(quittBrokrebot, baseCurrencyAddress, quittShare);

  console.log("register tbo");
  const tboBrokerbot = "0xCf1f5270916E41f5cf4221F68798438c3E5404E6";
  const tboShare = "0xb446566d6D644249D5D82aab5fea8a5B7DA3f691";
  await brokerbotRegistry.registerBrokerbot(tboBrokerbot, baseCurrencyAddress, tboShare);

  console.log("register boss");
  const bossBrokerbot = "0xe634160eeb1e5667621b4fe328E89D9Cb905235E";
  const bossShare = "0x2E880962A9609aA3eab4DEF919FE9E917E99073B";
  await brokerbotRegistry.registerBrokerbot(bossBrokerbot, baseCurrencyAddress, bossShare);

  console.log("register swissshore");
  const ssBrokerbot = "0x82B26de8227E23014c6F29f7fBbc20EE8BE794A9";
  const ssShare = "0x34B4f3a225057361Bfe663De0aAE77C5f6acF2ce";
  await brokerbotRegistry.registerBrokerbot(ssBrokerbot, baseCurrencyAddress, ssShare);

  console.log("register veda");
  const vedaBrokerbot = "0x2ffd9AD26E0440970B74e02116102080D3e0Acb9";
  const vedaShare = "0x2AdCbeE886D23EFF5ADECC7767Bf102E4A1CE151";
  await brokerbotRegistry.registerBrokerbot(vedaBrokerbot, baseCurrencyAddress, vedaShare);

  console.log("register aydea");
  const aydeaBrokerbot = "0xbe2057bAC4157Bba00759f61dacB08A64F703C2d";
  const aydeaShare = "0x3De64c8C6cFBD03CFcBb45A05381c5aED8c48Ae3";
  await brokerbotRegistry.registerBrokerbot(aydeaBrokerbot, baseCurrencyAddress, aydeaShare);

  console.log("register realunit");
  const realBrokerbot = "0x99D77d8FD7E78C3d4fCC85Dcca494B71ac42845E";
  const realShare = "0x553C7f9C780316FC1D34b8e14ac2465Ab22a090B";
  await brokerbotRegistry.registerBrokerbot(realBrokerbot, baseCurrencyAddress, realShare);

  console.log("register alanfrei");
  const freiBrokerbot = "0x56fCa58a92930729309Ed4Cad09899190209220C";
  const freiShare = "0x453e384862245FAf4E021894d78BA8f6E51B8c19";
  await brokerbotRegistry.registerBrokerbot(freiBrokerbot, baseCurrencyAddress, freiShare);

}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });