require("dotenv").config();
const { getImpersonatedSigner } = require("../test/helper/index");
const { ethers } = require("hardhat");
const {decodeError} = require("ethers-decode-error");
// Shared  Config
const config = require("./deploy_config.js");


const xchfWhale = "0x7B4576d06D0Ce1F83F9a9B76BF8077bFFD34FcB1";
const daksWhale = "0xfa20215178a0E69b8DD02462238027cAC19fb7d2"
const daksMulti = "0x4fd9dba1d53b7e6cc933a2fdd12b1c012a0654f6";
const daksBrokerbot = "0x3a2148cea2a8a4dae51487fa28451038c24d2576";
const daksAdr = "0x6f38e0f1a73c96cB3f42598613EA3474F09cB200";
const usdcWhale = "0xDa9CE944a37d218c3302F6B82a094844C6ECEb17";


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
  const quoterContract = await ethers.getContractAt("BrokerbotQuoter", config.brokerbotQuoter);
    // update to new paymenthub
    const paymentHub = await ethers.getContract("PaymentHub");
    const brokerbot = await ethers.getContractAt("Brokerbot", daksBrokerbot);
    const multisig = await getImpersonatedSigner(daksMulti);
    await brokerbot.connect(multisig).setPaymentHub(paymentHub.address);

  // get quote for buying shares
  const quoteBuy = await quoterContract.callStatic.quoteExactOutputSingle(baseCurrency.address, daksContract.address, 0, 10, 0);
  console.log(`Quote for buying 10 DAKS shares: ${ethers.utils.formatUnits(quoteBuy, 18)} XCHF`);

  // quote for selling shares
  const quoteSell = await quoterContract.callStatic.quoteExactInputSingle(daksContract.address, baseCurrency.address, 0, 10, 0);
  console.log(`Quote for selling 10 DAKS shares: ${ethers.utils.formatUnits(quoteSell, 18)} XCHF`);

  // get quote for buying with path
  // shares - base - weth - usdc
  const types = ["address", "uint24","address","uint24","address","uint24","address"];
  const values = [daksAdr, 0, config.baseCurrencyAddress, 500, config.wethAddress, 500, config.usdcAddress];
  const path = ethers.utils.solidityPack(types,values);
  console.log(path);
  const quoteBuyUsdc = await quoterContract.callStatic["quoteExactOutput(bytes,uint256)"](path, 10);
  console.log(`Quote for buying 10 DAKS shares: ${ethers.utils.formatUnits(quoteBuyUsdc, 6)} USDC`);

}
  
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });