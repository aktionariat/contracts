const Confirm = require('prompt-confirm');
const nconf = require('nconf');
const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
const { utils, Wallet } = require("zksync-web3");
require("dotenv").config();
const CONTRACT_NAME = "RecoveryHub";

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  
  const wallet = new Wallet(process.env.PRIVATE_KEY_TEST)
  const zkdeployer = new Deployer(hre, wallet);  
  
  if (network.name != "hardhat"&& !nconf.get("silent")) {
    console.log("-----------------------")
    console.log("Deploy RecoveryHub")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("deployer zk: %s", zkdeployer.ethWallet.address);

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }
/*
  // Deposit some funds to L2 in order to be able to perform L2 transactions.
  const depositAmount = ethers.utils.parseEther("0.1");
  const depositHandle = await zkdeployer.zkWallet.deposit({
    to: zkdeployer.zkWallet.address,
    token: utils.ETH_ADDRESS,
    amount: depositAmount,
  });
  console.log("deposit eth to zksync ...");
  await depositHandle.wait();

  const artifact = await zkdeployer.loadArtifact(RECOVERY_HUB);
  const recoveryHubContract = await zkdeployer.deploy(artifact, []);
  console.log("Deployed %s at %s", RECOVERY_HUB, recoveryHubContract.address);
  
*/

try {
  const { address } = await deploy(CONTRACT_NAME, {
    contract: CONTRACT_NAME,
    from: deployer,
    args: [],
    log: true,
    //maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    //maxFeePerGas: feeData.maxFeePerGas
    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT
  });
} catch (e) {
  console.log(e.message);
  throw e;
}
};

module.exports.tags = ["RecoveryHub"];