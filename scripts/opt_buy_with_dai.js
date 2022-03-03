const {network, ethers, deployments, getNamedAccounts} = require("hardhat");
const { namedAccounts } = require("../hardhat.config.js");
const config = require("../scripts/deploy_config_optimism.js");
require("dotenv").config();


async function main() {

  const daiAmount = await ethers.utils.parseEther("0.1");
  const daiContract = await ethers.getContractAt("ERC20Basic", config.daiAddress);
  const brokerbot = await ethers.getContractAt("Brokerbot", "0xeaEE772489648614316AB1323ee8Db20890D9bF0");
  const paymentHub = await ethers.getContractAt("PaymentHub", "0xDC6715b0d5ad3AdD9e9Bd4b2c49df2BB220AD44A");
  await daiContract.approve(paymentHub.address, daiAmount);

  console.log(await daiAmount.toString());
  console.log(await brokerbot.getPrice().then(p => p.toString()));

  const brokerbotBalanceBefore = await daiContract.balanceOf(brokerbot.address);
  console.log(brokerbotBalanceBefore.toString());
  const overrides = { gasLimit: 100000 };
  await paymentHub["payAndNotify(address,uint256,bytes)"](brokerbot.address, daiAmount, "0x01", overrides);
  const brokerbotBalanceAfter = await daiContract.balanceOf(brokerbot.address);
  console.log(brokerbotBalanceAfter.toString());


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });