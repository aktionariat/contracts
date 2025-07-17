import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Authorization, Contract } from "ethers";
import AktionariatSmartAccountModule from "../../ignition/modules/aktionariat/SmartAccount";
import { AktionariatSmartAccount } from "../../typechain-types";

async function deployAktionariatSmartAccountFixture() {
  return hre.ignition.deploy(AktionariatSmartAccountModule, { strategy: "create2" });
}

describe("Aktionariat Smart Account", function () {
  let deployer: HardhatEthersSigner, authority: HardhatEthersSigner;
  
  let smartAccount: Contract;
  let authorityAsContract: AktionariatSmartAccount;
  let authorization: Authorization
  
  before(async function() {
    [deployer, authority] = await ethers.getSigners();
    ({ smartAccount } = await deployAktionariatSmartAccountFixture());
  });

  it("Should deploy smart account successfully", async function () {
    console.log("Smart Account Address:", await smartAccount.getAddress());
    expect(await smartAccount.getAddress()).to.not.be.null
  });

  it("Should be able to sign an authorization from authority", async function () {
    // Parameters for EIP-7702 delegation
    const chainId = 0; // Any chain ID for testing purposes. Open to replay attacks in production.
    const nonce = await authority.getNonce();
    const delegatedAddress = await smartAccount.getAddress();

    authorization = await authority.authorize({
      address: delegatedAddress,
      nonce: nonce,
      chainId: chainId
    });
  });

  it("Should be able to use authority address as a contract", async function () {
    authorityAsContract = await ethers.getContractAt("AktionariatSmartAccount", authority)
    expect(await authorityAsContract.getAddress()).to.not.be.null
  });

  it("Should be able to fetch next nonce with authorization", async function () {
    const nextNonce = await authorityAsContract["nextNonce"].staticCall(
    {
      type: 4,
      authorizationList: [authorization],
    });

    console.log("Next Nonce:", nextNonce.toString());
    expect(nextNonce).to.not.be.null;
  });
});