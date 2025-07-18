import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Authorization, Contract, TransactionRequest, Wallet } from "ethers";
import SmartAccountModule from "../../ignition/modules/aktionariat/SmartAccount";
import { SmartAccount } from "../../typechain-types";

async function deploySmartAccountFixture() {
  return hre.ignition.deploy(SmartAccountModule, { strategy: "create2" });
}

describe("Smart Account", function () {
  let deployer: HardhatEthersSigner, authority: HardhatEthersSigner, signer2: HardhatEthersSigner;
  
  let smartAccount: Contract;
  let authorityAsContract: SmartAccount;
  let authorization: Authorization
  let type4TransactionArgs: {
    type: number;
    authorizationList: Authorization[];
  };
  
  before(async function() {
    [deployer, authority, signer2] = await ethers.getSigners();
    ({ smartAccount } = await deploySmartAccountFixture());
  });

  it("Should deploy smart account successfully", async function () {
    console.log("Smart Account Address:", await smartAccount.getAddress());
    expect(await smartAccount.getAddress()).to.not.be.null
  });

  it("Should be able to sign an authorization from authority", async function () {
    // Parameters for EIP-7702 delegation
    const chainId = 1; // Any chain ID for testing purposes. Open to replay attacks in production.
    const nonce = await authority.getNonce();
    const delegatedAddress = await smartAccount.getAddress();

    authorization = await authority.authorize({
      address: delegatedAddress,
      nonce: nonce,
      chainId: chainId
    });
    expect(authorization).to.not.be.null;

    type4TransactionArgs = { type: 4, authorizationList: [authorization] };
  });

  it("Should be able to use authority address as a contract", async function () {
    authorityAsContract = await ethers.getContractAt("SmartAccount", authority)
    expect(await authorityAsContract.getAddress()).to.not.be.null
  });

  it("Should be able to fetch data with authorization", async function () {
    const nextNonce = await authorityAsContract.nextNonce(type4TransactionArgs);
    expect(nextNonce).to.not.be.null;

    const version = await authorityAsContract.VERSION(type4TransactionArgs);
    expect(version).to.not.be.null;
  });

  it("Should be able to find a free nonce", async function () {
    const nextNonce = await authorityAsContract.nextNonce(type4TransactionArgs);
    expect(nextNonce).to.not.be.null;

    const isFree = await authorityAsContract.isFree(nextNonce, type4TransactionArgs);
    expect(isFree).to.be.true;    
  });

  it("Should be able to execute an ETH transfer with authorization", async function () {
    const nextNonce = await authorityAsContract.nextNonce(type4TransactionArgs);
    const recipient = signer2.address;
    const value = ethers.parseEther("0.01");

    const transactionHash = await authorityAsContract.calculateTransactionHash(nextNonce, recipient, value, "0x", type4TransactionArgs);
    console.log("Transaction Hash:", transactionHash);

    const numNonce = Number(nextNonce);
    console.log("Next Nonce:", nextNonce);
    console.log("Next Nonce:", numNonce.toString());

    const transactionRequest: TransactionRequest = {
      type: 1,
      to: recipient,
      nonce: Number(nextNonce),
      value: value,
      data: "0x",
      chainId: 1,
      gasPrice: parseInt(ethers.hexlify(await authorityAsContract.contractId(type4TransactionArgs)), 16),
      gasLimit: 21000
    }

    // IN PROGRESS

    const signature = (await signer2.provider.send("eth_sign", [signer2.address, transactionHash])).substr(2);

    const r = '0x' + signature.slice(0, 64)
    const s = '0x' + signature.slice(64, 128)
    const v = '0x' + signature.slice(128, 130)

    console.log("Signature:", { r, s, v });

    expect(await authorityAsContract.checkSignature(nextNonce, recipient, value, "0x", v, r, s, type4TransactionArgs)).to.not.be.reverted;

  });


  
});