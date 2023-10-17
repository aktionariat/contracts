require("dotenv").config();
const { getImpersonatedSigner } = require("../test/helper/index");
const { ethers } = require("hardhat");
// Shared  Config
const config = require("./deploy_config.js");


const xchfWhale = "0x7B4576d06D0Ce1F83F9a9B76BF8077bFFD34FcB1";
const daksWhale = "0xfa20215178a0E69b8DD02462238027cAC19fb7d2"
const daksMulti = "0x4fd9dba1d53b7e6cc933a2fdd12b1c012a0654f6";
const daksBrokerbot = "0x3a2148cea2a8a4dae51487fa28451038c24d2576";
const daksAdr = "0x6f38e0f1a73c96cB3f42598613EA3474F09cB200";


async function main() {
  const deployment = await hre.run("deploy", {
    tags: "ExampleTrades",
  });
  await hre.run("deploy", {
    tags: "PaymentHub"
  })
  // get common contracts
  const baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
  const usdcContract = await ethers.getContractAt("ERC20Named", config.usdcAddress);
  const daksContract = await ethers.getContractAt("DraggableShares", daksAdr);
  // update to new paymenthub
  const paymentHub = await ethers.getContract("PaymentHub");
  const brokerbot = await ethers.getContractAt("Brokerbot", daksBrokerbot);
  const multisig = await getImpersonatedSigner(daksMulti);
  await brokerbot.connect(multisig).setPaymentHub(paymentHub.address);

  const signer = await getImpersonatedSigner(xchfWhale);
  const startBlanceXCHF = await baseCurrency.balanceOf(xchfWhale);
  const exampleTrades = await ethers.getContract("ExampleTrades");
  console.log(`Approving XCHF...`);
  await baseCurrency.connect(signer).approve(exampleTrades.address, ethers.constants.MaxUint256);
  console.log(`Buying shares...`);
  await exampleTrades.connect(signer).buySharesDirect(10, ethers.utils.parseEther("200"));
  const balanceShares = await daksContract.balanceOf(xchfWhale);
  console.log(`Shares bought: ${balanceShares}`);
  console.log("======================");
  console.log("Approving DAKS..");
  await daksContract.connect(signer).approve(exampleTrades.address, 10);
  console.log("Selling Shares..");  
  await exampleTrades.connect(signer).sellSharesDirect(10);
  const endBlanceXCHF = await baseCurrency.balanceOf(xchfWhale);
  console.log(`xchf balance difference: ${startBlanceXCHF - endBlanceXCHF}`);




  
}
  
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });