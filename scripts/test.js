const {network, ethers, deployments, } = require("hardhat");
const config = require("../scripts/deploy_config_polygon.js");


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


const index = ethers.utils.solidityKeccak256(
  ["uint256", "uint256"],
  [accounts[0], config.baseCurrencyBalanceSlot] // key, slot
);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
