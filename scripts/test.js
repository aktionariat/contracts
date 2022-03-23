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

[owner,sig1,sig2,sig3,sig4,oracle] = await ethers.getSigners();
signers = [owner,sig1,sig2,sig3,sig4];
accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address];

const paymentHub = await ethers.getContractAt("PaymentHub", "0xfb330379134EA1EfCE9Cf6F28E2CcB917899e007");
const priceinETH = await paymentHub.callStatic["getPriceInEther(uint256,address)"](ethers.utils.parseEther("1000"), "0x1abD8b5194D733691D64c3F898300f88Ba0035d5");
console.log(priceinETH.toString());
console.log(priceinETH);
const oraclePrice = await paymentHub.getPriceInEtherFromOracle(ethers.utils.parseEther("1000"), "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08");
console.log(oraclePrice.toString());
const usdchf = ethers.BigNumber.from("107230600")
const usdeth = ethers.BigNumber.from("295556141460");
const rate = usdchf.mul(ethers.utils.parseEther("1000")).div(usdeth);
console.log(rate.toString());

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });