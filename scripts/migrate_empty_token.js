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

  const { deploy } = deployments;

  const feeData = await ethers.provider.getFeeData();

  // deploy shares contract
  const symbol = "SHR";
  const name = "Test Shares";
  const terms = "test.ch/terms";
  const totalShares = 10500000;
  const recoveryHub = "0xc6AfD3b605957b9BA94143F59d451c657F507516";
  {
  let { address } = await deploy("Shares1", {
    contract: "Shares",
    from: deployer.address,
    args: [
      symbol,
      name,
      terms,
      totalShares,
      owner.address,
      recoveryHub],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
  shares = await ethers.getContractAt("Shares", address);
}
  // deploy draggable contract

  const quorumBps = 7500;
  const quorumMigration = 7500;
  const votePeriodSeconds = 5184000;
  const offerFactory = "0x2BC8102bC1EaB3689f0dAdB53071AB5965cEEfd4";
  {
  let { address } = await deploy("DraggableShares1", {
    contract: "DraggableShares",
    from: deployer.address,
    args: [
      terms,
      shares.address,
      quorumBps,
      quorumMigration,
      votePeriodSeconds,
      recoveryHub,
      offerFactory,
      owner.address],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
  draggable = await ethers.getContractAt("DraggableShares", address);
  }
  // deploy invalid contract
  {
    console.log("test");
  const { address } = await deploy("InvalidContract", {
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
  });
  invalid = await ethers.getContractAt("InvalidContract", address);
  }
  // do migration
  await shares.connect(owner).mintAndCall(deployer.address, draggable.address, 1, "0x01");
  console.log(`shares supply: ${await shares.totalSupply()}`);
  await draggable.connect(owner).setOracle(deployer.address);
  console.log(`draggable supply: ${await draggable.totalSupply()}`);
  await invalid.connect(deployer).mint(draggable.address, 1);
  console.log(`invalid supply: ${await invalid.totalSupply()}`);
  await draggable.connect(deployer).migrateWithExternalApproval(invalid.address, 10000000);
  await draggable.connect(deployer).burn(1);
  console.log(`draggable supply: ${await draggable.totalSupply()}`);
  console.log(`invalid supply: ${await invalid.totalSupply()}`);
  console.log(`shares supply: ${await shares.totalSupply()}`);
  console.log(`draggable name: ${await draggable.name()}`);
  console.log(`draggable symbol: ${await draggable.symbol()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });