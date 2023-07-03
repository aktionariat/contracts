const {network, ethers, deployments, } = require("hardhat");
const config = require("../scripts/deploy_config.js");


async function main() {

  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let accounts;
  let signers;
  let deployer;
  
  let shares;
  let draggable;
  let invalid;


  [deployer,owner,sig1,sig2,sig3,sig4,oracle] = await ethers.getSigners();
  signers = [owner,sig1,sig2,sig3,sig4];
  accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address];
  // mainnet deployer
  /*await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0x39E5351E6CE3c4B19B8b0a2F5C82c511782457BE"],
  });
  deployer = await ethers.getSigner("0x39E5351E6CE3c4B19B8b0a2F5C82c511782457BE");*/

  const { deploy } = deployments;

  const feeData = await ethers.provider.getFeeData();

  // deploy shares contract
  shares = await ethers.getContractAt("Shares", "0x5a90E48b81Edf50813192E5F5Da0ED934Bf94c93");

  // deploy draggable contract
  draggable = await ethers.getContractAt("DraggableShares", "0x453e384862245FAf4E021894d78BA8f6E51B8c19");
  
  // deploy invalid contract
  /*const { address } = await deploy("InvalidContract", {
    contract: "InvalidContract",
    from: deployer.address,
    args: [
      deployer.address,
      shares.address,
      draggable.address,
      'OLD',
      'Invalid Share'],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });*/
  invalid = await ethers.getContractAt("InvalidContract", "0x27A02627F4D683594984984f0fD2dE9Aa3C8B2f5");
  

  // impersonate owner
  /*await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0x4d307525b22897ca07af7e34079397f3d7ae60a2"],
  });
  const ownerAF = await ethers.getSigner("0x4d307525b22897ca07af7e34079397f3d7ae60a2");
  // do migration
  await sendEther(deployer, ownerAF.address, "0.1");
  await shares.connect(ownerAF).mintAndCall(deployer.address, draggable.address, 1, "0x01");*/
  console.log(`shares supply: ${await shares.totalSupply()}`);
  //await draggable.connect(ownerAF).setOracle(deployer.address);
  console.log(`draggable supply: ${await draggable.totalSupply()}`);
  //await invalid.connect(deployer).mint(draggable.address, 1);
  console.log(`invalid supply: ${await invalid.totalSupply()}`);
  await draggable.connect(deployer).migrateWithExternalApproval(invalid.address, 10000000);
  await draggable.connect(deployer).burn(1);
  console.log(`draggable supply: ${await draggable.totalSupply()}`);
  console.log(`invalid supply: ${await invalid.totalSupply()}`);
  console.log(`shares supply: ${await shares.totalSupply()}`);
  console.log(`draggable name: ${await draggable.name()}`);
  console.log(`draggable symbol: ${await draggable.symbol()}`);
}

async function sendEther(signer, to, amount) {
  const tx = await signer.sendTransaction({
    to: to,
    value: ethers.utils.parseEther(amount)
  });
  return await tx.wait();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });