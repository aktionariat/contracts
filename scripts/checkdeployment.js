const {network, ethers, deployments, getNamedAccounts} = require("hardhat");
const { namedAccounts } = require("../hardhat.config.js");
const config = require("../scripts/deploy_config_optimism.js");


async function main() {

let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let accounts;
  let signers;

[owner,sig1,sig2,sig3,sig4,oracle] = await ethers.getSigners();
signers = [owner,sig1,sig2,sig3,sig4];
accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address];


const shares = await ethers.getContractAt("Shares", "0x89888fEd5309180606137D6e17236331A3f9d3ED");
const draggable = await ethers.getContractAt("DraggableShares", "0x8fa9eCd14BBCb24CEd18E16692E49b388f07257e");
const brokerbot = await ethers.getContractAt("Brokerbot", "0x528C988a9790cD4EBD8A3e64Fc96686a6E81A099");
console.log("shares named: %s", await shares.name());
console.log("brokerbot version: %s", await brokerbot.VERSION());
console.log("draggable terms: %s", await draggable.terms());
console.log("draggable name: %s", await draggable.name());
console.log("draggable ticker: %s", await draggable.symbol());
console.log("draggable quorum: %s", await draggable.quorum());
console.log("shares version: %s", await shares.VERSION());


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });