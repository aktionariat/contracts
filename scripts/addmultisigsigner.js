const {network, ethers, deployments, getNamedAccounts} = require("hardhat");
const { namedAccounts } = require("../hardhat.config.js");
const config = require("../scripts/deploy_config_optimism.js");
require("dotenv").config();


async function main() {

  const anEthersProvider = new ethers.providers.Web3Provider(network.provider)
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, anEthersProvider);

  const overrides = { gasLimit: 100000, };

  multiSigClone = await ethers.getContractAt("MultiSigWalletV2","0xc87EB78E1E64d0604bcD9C7EF0F691316943C7d7");
  const tx = await multiSigClone.setSigner("0xadc5f97dc7cca2d75cb9951dfc5ae5f29fefc479", 1, overrides);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });