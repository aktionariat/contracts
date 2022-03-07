const {network, ethers, deployments, getNamedAccounts} = require("hardhat");
const { namedAccounts } = require("../hardhat.config.js");
const config = require("../scripts/deploy_config_optimism.js");
require("dotenv").config();


async function main() {

  const anEthersProvider = new ethers.providers.Web3Provider(network.provider)
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, anEthersProvider);

  const overrides = { gasLimit: 100000, };

  const qouter = await ethers.getContractAt("IQuoter","0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6");
  const types = ["address","uint24","address","uint24","address"];
  //const values = [config.baseCurrencyAddress, 500, config.daiAddress, 3000, config.wethAddress];
  const values = [config.wethAddress, 3000, config.daiAddress, 500, config.baseCurrencyAddress];
  const path = ethers.utils.solidityPack(types,values);

  const tx = await qouter.callStatic["quoteExactOutput(bytes,uint256)"](path, ethers.utils.parseEther("100"));
  const x = await tx.wait();
  console.log(x);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });