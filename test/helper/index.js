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
  const newFormatedBalance = toBytes32(locallyManipulatedBalance).toString();

  for (let i = 0; i < 6; i++) {
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
  await tx.wait();
}

async function buyingEnabled(brokerbot) {
  const settings = await brokerbot.settings();
  return (settings & await brokerbot.BUYING_ENABLED()) == await brokerbot.BUYING_ENABLED();
}

async function sellingEnabled(brokerbot) {
  const settings = await brokerbot.settings();
  return (settings & await brokerbot.SELLING_ENABLED()) == await brokerbot.SELLING_ENABLED();
}


//export * from "./time"

module.exports = { mintERC20, setBalance, sendEther, buyingEnabled, sellingEnabled};
