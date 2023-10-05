require("dotenv").config();
const { getImpersonatedSigner } = require("../test/helper/index");
const { ethers } = require("hardhat");
// Shared  Config
const config = require("./deploy_config.js");


const xchfWhale = "0x7B4576d06D0Ce1F83F9a9B76BF8077bFFD34FcB1";
const daksWhale = "0xfa20215178a0E69b8DD02462238027cAC19fb7d2"


async function main() {
  const deployment = await hre.run("deploy", {
    tags: "ExampleTrades",
  });
  // get common contracts
  const baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
  const usdcContract = await ethers.getContractAt("ERC20Named", config.usdcAddress);

  const signer = await getImpersonatedSigner(xchfWhale);
  const exampleTrades = await ethers.getContract("ExampleTrades");
  console.log(`Approving XCHF...`);
  await baseCurrency.connect(signer).approve(exampleTrades.address, ethers.constants.MaxUint256);
  console.log(`Buying shares...`);
  await exampleTrades.connect(signer).buySharesDirect(10, ethers.utils.parseEther(200));
  const balanceShares = await baseCurrency.balanceOf(signer.address);
  console.log(`Shares bought: ${balanceShares}`);


  
}
  
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });