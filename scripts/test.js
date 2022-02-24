const {network, ethers, deployments, getNamedAccounts} = require("hardhat");
const { namedAccounts } = require("../hardhat.config.js");
const config = require("../scripts/deploy_config_optimism.js");


async function main() {

/*let owner;
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
  [accounts[0], config.xchfBalanceSlot] // key, slot
);


await deployments.fixture(["Shares", "PaymentHub", "Brokerbot", "BrokerbotDAI"]);
paymentHub = await ethers.getContract("PaymentHub");
shares = await ethers.getContract("Shares");
brokerbot = await ethers.getContract("Brokerbot");
brokerbotDAI = await ethers.getContract("BrokerbotDAI");
const namedAccounts = await getNamedAccounts();
const deployer = namedAccounts.deployer;
//console.log(namedAccounts);
*/

const dai = await ethers.getContractAt("ERC20", "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1");
console.log(await dai.decimals());
const shares = await ethers.getContractAt("Shares", "0xE4294c9698ca44F244575185E669BdB447DaF2E5");
console.log(await shares.name());

await shares.mint("0xeaEE772489648614316AB1323ee8Db20890D9bF0", 5000);

//const paymentHub = await ethers.getContractAt("PaymentHub", "0xDC6715b0d5ad3AdD9e9Bd4b2c49df2BB220AD44A");

/*
const uniswapQuoter = await ethers.getContractAt("IQuoter", "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6");
console.log(await uniswapQuoter.WETH9());

const quote = await uniswapQuoter.quoteExactOutputSingle(uniswapQuoter.WETH9(), "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", 3000, 10000000000, 0);

const chainlink = await ethers.getContractAt("AggregatorV3Interface", "0x13e3Ee699D1909E989722E753853AE30b17e08c5");
//console.log(chainlink);
//console.log(ethers.provider);
console.log(await chainlink.version());
console.log(await chainlink.latestRoundData());
/*await paymentHub.getLatestPriceCHFUSD();
const priceeth = await paymentHub.getLatestPriceETHUSD();
console.log(await priceeth.toString());*/

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });