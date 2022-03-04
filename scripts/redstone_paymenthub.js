const {network, ethers, deployments, getNamedAccounts} = require("hardhat");
const { namedAccounts } = require("../hardhat.config.js");
const config = require("../scripts/deploy_config_optimism.js");
const  { WrapperBuilder } = require("redstone-evm-connector");
require("dotenv").config();


async function main() {

  const anEthersProvider = new ethers.providers.Web3Provider(network.provider)
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, anEthersProvider);

  const overrides = { gasLimit: 200000, };

  const paymentHub =  await ethers.getContractAt("PaymentHub","0x20D1c515e38aE9c345836853E2af98455F919637");
  const wrapped = WrapperBuilder.wrapLite(paymentHub).usingPriceFeed("redstone-stocks");
  const priceChfUsd = await wrapped.getLatestPriceCHFUSD(overrides);
  const priceEthUsd = await wrapped.getLatestPriceETHUSD();
  const priceInEthChf = await wrapped.getPriceInEtherFromOracle(ethers.utils.parseEther('100'), "0xE4F27b04cC7729901876B44f4EAA5102EC150265");

  console.log("price chf/usd: %s", priceChfUsd.toString());
  console.log("price eth/usd: %s", priceEthUsd.toString());
  console.log("price eth/chf: %s", ethers.utils.formatEther(priceInEthChf));

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });