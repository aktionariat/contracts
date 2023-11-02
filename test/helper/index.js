const {network, ethers, deployments, getNamedAccounts} = require("hardhat");
const config = require("../../scripts/deploy_config.js")
const Chance = require("chance");
const { Transaction } = require("ethers");

const toBytes32 = (bn) => {
  return ethers.hexlify(ethers.zeroPadValue('0x'+bn.toString(16), 32));
};

const setStorageAt = async (address, index, value) => {
  await ethers.provider.send("hardhat_setStorageAt", [address, index, value]);
  await ethers.provider.send("hardhat_mine", []); // Just mines to the next block
};

async function mintERC20(forceSend, erc20Contract, minterAddress, accounts){
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [minterAddress],
  });
  const signer = await ethers.provider.getSigner(minterAddress);
  await forceSend.send(minterAddress, {value: ethers.parseEther("2")});
  for (let i = 0; i < 5; i++) {
    await erc20Contract.connect(signer).mint(accounts[i], ethers.parseEther("10000000"));
    //console.log("account %s chf %s", accounts[i], await baseCurrency.balanceOf(accounts[i]));
  }
  await network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [minterAddress],
  });
}

async function setBalance(erc20Contract, slot, accounts) {
  const locallyManipulatedBalance = ethers.parseEther("100000000");
  setBalanceWithAmount(erc20Contract, slot, accounts, locallyManipulatedBalance);
}

async function setBalanceWithAmount(erc20Contract, slot, accounts, amount) {
  let newFormatedBalance = toBytes32(amount).toString();    

  for (let i = 0; i < accounts.length; i++) {
    // Get storage slot index
    const index = ethers.solidityPackedKeccak256(
      ["uint256", "uint256"],
      [accounts[i], slot] // key, slot
    ); 
    
    // Manipulate local balance (needs to be bytes32 string)
    await setStorageAt(
      await erc20Contract.getAddress(),
      index.toString(),
      newFormatedBalance
    );
    //console.log("account %s %s %s", accounts[i], await erc20Contract.symbol(), await erc20Contract.balanceOf(accounts[i]));
  }
};

async function sendEther(signer, to, amount) {
  const tx = await signer.sendTransaction({
    to: to,
    value: ethers.parseEther(amount)
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

async function setup(setupBrokerbotEnabled) {
  let baseCurrency;
  let brokerbot;
  let recoveryHub;
  let offerFactory;
  let draggableShares;
  let shares;
  let paymentHub;
  let successor;
  let successorExternal;

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
  
  // get common contracts
  baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
  daiContract = await ethers.getContractAt("ERC20Named", config.daiAddress);
  wbtcContract = await ethers.getContractAt("ERC20Named", config.wbtcAddress);
  usdcContract = await ethers.getContractAt("ERC20Named", config.usdcAddress);
  baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
  
  // deploy contracts
  await deployments.fixture([
    "RecoveryHub",
    "OfferFactory",
    "Shares",
    "DraggableShares",
    "AllowlistShares",
    "PaymentHub",
    "Brokerbot",
    "BrokerbotRegistry",
    "BrokerbotRouter",
    "BrokerbotQuoter",
    "DraggableSharesWithPredecessor",
    "DraggableSharesWithPredecessorExternal"
  ]);
  
  paymentHub = await ethers.getContract("PaymentHub");
  recoveryHub = await ethers.getContract("RecoveryHub");
  offerFactory = await ethers.getContract("OfferFactory");
  shares = await ethers.getContract("Shares");
  draggableShares = await ethers.getContract("DraggableShares");
  successor = await ethers.getContract("DraggableSharesWithPredecessor");
  successorExternal = await ethers.getContract("DraggableSharesWithPredecessorExternal");
  brokerbot = await ethers.getContract("Brokerbot");
  
  
  // Set Payment Hub for Brokerbot
  await brokerbot.connect(owner).setPaymentHub(await paymentHub.getAddress());

  // Allow payment hub to spend baseCurrency from accounts[0] and draggableShares from Brokerbot
  await draggableShares.connect(owner).approve(await paymentHub.getAddress(), config.infiniteAllowance);
  await baseCurrency.connect(owner).approve(await paymentHub.getAddress(), config.infiniteAllowance);
  await brokerbot.connect(owner).approve(await draggableShares.getAddress(), await paymentHub.getAddress(), config.infiniteAllowance);
  await brokerbot.connect(owner).approve(await baseCurrency.getAddress(), await paymentHub.getAddress(), config.infiniteAllowance);

  // Mint baseCurrency Tokens (xchf) to first 5 accounts
  await setBalance(baseCurrency, config.xchfBalanceSlot, accounts);
  // Set dai balance to frist 5 accounts
  await setBalance(daiContract, config.daiBalanceSlot, accounts);
  // set baseCurrency Token (xchf) at brokerbot to sell shares
  await setBalance(baseCurrency, config.xchfBalanceSlot, [await brokerbot.getAddress()]);

  //Mint shares to first 5 accounts
  for( let i = 0; i < accounts.length; i++) {
    await shares.connect(owner).mint(accounts[i], 1000000);
  }

  // Convert some Shares to DraggableShares
  for (let i = 0; i < signers.length; i++) {
    await shares.connect(signers[i]).approve(await draggableShares.getAddress(), config.infiniteAllowance);
    await draggableShares.connect(signers[i]).wrap(accounts[i], 900000);
  }

  if (setupBrokerbotEnabled) {
      // Deposit some shares/xchf to Brokerbot
      await draggableShares.connect(owner).transfer(await brokerbot.getAddress(), 500000);
      await baseCurrency.connect(owner).transfer(await brokerbot.getAddress(), ethers.parseEther("100000"));
  }  
}

async function getTX(to, dataTX, multisigclone, wallet, chainid) {
  const contractId = await multisigclone.connect(wallet).contractId();
  const seq = await multisigclone.nextNonce();
  const tx_send_ms = {
    nonce: seq,
    gasPrice: contractId,
    gasLimit: 21000,
    to: to,
    data: dataTX.data,
    chainId: chainid,
    type: 0
  };
  const flatSig = await wallet.signTransaction(tx_send_ms);
  const tx1 = Transaction.from(flatSig);
  return tx1;
}
 async function getBlockTimeStamp(ethers) {
  // get block timestamp
  const blockNum = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNum);
  return block.timestamp;
 }

//get signer from address through impersonating account with hardhat
async function getImpersonatedSigner(impersonateAddress) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [impersonateAddress],
  });
  const signer = ethers.provider.getSigner(impersonateAddress);
  return signer;
}

function randomBigInt(min, max) {
  return BigInt(new Chance().natural({ min: min, max: max }));

}


//export * from "./time"

module.exports = {
  mintERC20,
  setBalance,
  sendEther,
  buyingEnabled,
  sellingEnabled,
  setBalances,
  setup,
  setBalanceWithAmount,
  getTX,
  getBlockTimeStamp,
  getImpersonatedSigner,
  randomBigInt
};
