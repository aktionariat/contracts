const {network, ethers, deployments, getNamedAccounts} = require("hardhat");
const { namedAccounts } = require("../hardhat.config.js");
const config = require("../scripts/deploy_config_optimism.js");
const  { WrapperBuilder } = require("redstone-evm-connector");
require("dotenv").config();


async function main() {

  const anEthersProvider = new ethers.providers.Web3Provider(network.provider)
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, anEthersProvider);

  const overrides = { gasLimit: 200000, };

  const paymentHub =  await ethers.getContractAt("PaymentHub","0xAF21E166ADc362465A27AeDc15315DcFc0c51624");
  const wrapped = WrapperBuilder.wrapLite(paymentHub).usingPriceFeed("redstone-stocks");
  const priceChfUsd = await wrapped.getLatestPriceCHFUSD(overrides);
  const priceEthUsd = await wrapped.getLatestPriceETHUSD();

  console.log("price chf/usd: %s", priceChfUsd.toString());
  console.log("price eth/usd: %s", priceEthUsd.toString());

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });