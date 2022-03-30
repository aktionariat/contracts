const {network, ethers, deployments, } = require("hardhat");
const config = require("../../scripts/deploy_config.js")

const toBytes32 = (bn) => {
  return ethers.utils.hexlify(ethers.utils.zeroPad(bn.toHexString(), 32));
};

const setStorageAt = async (address, index, value) => {
  await ethers.provider.send("hardhat_setStorageAt", [address, index, value]);
  await ethers.provider.send("evm_mine", []); // Just mines to the next block
};

async function mintERC20(forceSend, erc20Contract, minterAddress, accounts){

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [minterAddress],
  });
  const signer = await ethers.provider.getSigner(minterAddress);
  await forceSend.send(minterAddress, {value: ethers.utils.parseEther("2")});
  for (let i = 0; i < 5; i++) {
    await erc20Contract.connect(signer).mint(accounts[i], ethers.utils.parseEther("10000000"));
    //console.log("account %s chf %s", accounts[i], await baseCurrency.balanceOf(accounts[i]));
  }
  await network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [minterAddress],
  });
}

async function setBalance(erc20Contract, slot, accounts) {
  const locallyManipulatedBalance = ethers.utils.parseEther("100000000");
  setBalanceWithAmount(erc20Contract, slot, accounts, locallyManipulatedBalance);
}

async function setBalanceWithAmount(erc20Contract, slot, accounts, amount) {
  const newFormatedBalance = toBytes32(amount).toString();

  for (let i = 0; i < accounts.length; i++) {
    // Get storage slot index
    const index = ethers.utils.solidityKeccak256(
      ["uint256", "uint256"],
      [accounts[i], slot] // key, slot
    );

    // Manipulate local balance (needs to be bytes32 string)
    await setStorageAt(
      erc20Contract.address,
      index.toString(),
      newFormatedBalance
    );
    //console.log("account %s %s %s", accounts[i], await erc20Contract.symbol(), await erc20Contract.balanceOf(accounts[i]));
  }
};

async function sendEther(signer, to, amount) {
  const tx = await signer.sendTransaction({
    to: to,
    value: ethers.utils.parseEther(amount)
  });
  return await tx.wait();
}

async function buyingEnabled(brokerbot) {
  const settings = await brokerbot.settings();
  return (settings & config.BUYING_ENABLED) == config.BUYING_ENABLED;
}

async function sellingEnabled(brokerbot) {
  const settings = await brokerbot.settings();
  return (settings & config.SELLING_ENABLED) == config.SELLING_ENABLED;
}

async function setBalances(accounts, baseCurrency, daiContract, wbtcContract) {
  // Mint baseCurrency Tokens (xchf) to first 5 accounts
    await setBalance(baseCurrency, config.xchfBalanceSlot, accounts);
    // Set (manipulate local) DAI balance for first 5 accounts
    await setBalance(daiContract, config.daiBalanceSlot, accounts);
    // Set (manipulate local) WBTC balance for first 5 accounts
    await setBalance(wbtcContract, config.wbtcBalanceSlot, accounts);
}

async function setup() {
  let baseCurrency;
  let brokerbot;
  let recoveryHub;
  let offerFactory;
  let draggableShares;
  let shares;
  let paymentHub;

  let deployer
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;
  let accounts;
  let signers;

  [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
  signers = [owner,sig1,sig2,sig3,sig4,sig5];
  accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
  
  // deploy contracts
  baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
  
  await deployments.fixture([
    "ReoveryHub",
    "OfferFactory",
    "Shares",
    "DraggableShares",
    "PaymentHub",
    "Brokerbot"
  ]);
  
  paymentHub = await ethers.getContract("PaymentHub");
  recoveryHub = await ethers.getContract("RecoveryHub");
  offerFactory = await ethers.getContract("OfferFactory");
  shares = await ethers.getContract("Shares");
  draggableShares = await ethers.getContract("DraggableShares");
  brokerbot = await ethers.getContract("Brokerbot");
  
  // Set Payment Hub for Brokerbot
  await brokerbot.connect(owner).setPaymentHub(paymentHub.address);

  // Allow payment hub to spend baseCurrency from accounts[0] and draggableShares from Brokerbot
  await draggableShares.connect(owner).approve(paymentHub.address, config.infiniteAllowance);
  await baseCurrency.connect(owner).approve(paymentHub.address, config.infiniteAllowance);
  await brokerbot.connect(owner).approve(draggableShares.address, paymentHub.address, config.infiniteAllowance);
  await brokerbot.connect(owner).approve(baseCurrency.address, paymentHub.address, config.infiniteAllowance);

  // Mint baseCurrency Tokens (xchf) to first 5 accounts
  await setBalance(baseCurrency, config.xchfBalanceSlot, accounts);

  //Mint shares to first 5 accounts
  for( let i = 0; i < accounts.length; i++) {
    await shares.connect(owner).mint(accounts[i], 1000000);
  }

  // Convert some Shares to DraggableShares
  for (let i = 0; i < signers.length; i++) {
    await shares.connect(signers[i]).approve(draggableShares.address, config.infiniteAllowance);
    await draggableShares.connect(signers[i]).wrap(accounts[i], 900000);
  }
  // Deposit some shares to Brokerbot
  await draggableShares.connect(owner).transfer(brokerbot.address, 500000);
  await baseCurrency.connect(owner).transfer(brokerbot.address, ethers.utils.parseEther("100000"));
}


//export * from "./time"

module.exports = { mintERC20, setBalance, sendEther, buyingEnabled, sellingEnabled, setBalances, setup, setBalanceWithAmount};
