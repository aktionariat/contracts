const {network, ethers, deployments, getNamedAccounts} = require("hardhat");
const { namedAccounts } = require("../hardhat.config.js");
const config = require("../scripts/deploy_config_optimism.js");
const  { WrapperBuilder } = require("redstone-evm-connector");
require("dotenv").config();


async function main() {

  const anEthersProvider = new ethers.providers.Web3Provider(network.provider)
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, anEthersProvider);

  const overrides = { gasLimit: 100000, };

  const paymentHub =  await ethers.getContractAt("PaymentHub","0xFFD6F1b3bc223C6D3AB4AF32167B4A93a148CA39");
  const wrapped = WrapperBuilder.wrapLite(paymentHub).usingPriceFeed("redstone");
  const priceChfUsd = await wrapped.getLatestPriceCHFUSD();
  console.log("price chf/usd: %s", priceChfUsd.toString());

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });