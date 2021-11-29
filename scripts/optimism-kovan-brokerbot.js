// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");


// Two items we need fron the @eth-optimism/contracts package.
//
// predeploys contains the addresses of the predeployed contracts on L2
// getContractInterface is a function that lets us get the ABI of contracts in the package
const { predeploys, getContractInterface } = require('@eth-optimism/contracts');

// For clarity this example uses global variables.
let l2Provider;
let l2Wallet;


const main = async () => {
    // Instantiate the wallet of L2
    l2Provider = new ethers.providers.JsonRpcProvider(hre.network.config.url);
    l2Wallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC_KOVAN);
    l2Wallet = l2Wallet.connect(l2Provider);

} //main




// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  })