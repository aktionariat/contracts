import hre, { ethers } from "hardhat";
import { Contract, solidityPackedKeccak256 } from "ethers";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import MultisigUpdateV6Module from "../../ignition/modules/aktionariat/MultisigUpdateV6";
import { switchForkedNetwork } from "../helpers/switchNetwork";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { getImpersonatedSigner } from "../helpers/getImpersonatedSigner";


async function deployMultisigUpdateV6ModuleFixture() {
  await switchForkedNetwork("optimism");
  console.log(await hre.network.provider.send('eth_chainId'));
  return hre.ignition.deploy(MultisigUpdateV6Module);
}

before(async function() {
  await switchForkedNetwork("optimism");
  console.log(await hre.network.provider.send('eth_chainId'));
});

describe("MultiSig V6 Multichain Deployment", function () {
  
  let multiSigWalletMasterV6: Contract;
  let testSymbol = "TEST"
  let testSalt = "0";

  let deploymentAddressMainnet: string;
  let deploymentAddressOptimism: string;

  describe("Deploy on Mainnet", function () {
    let multisigCloneFactory: Contract;
    let factoryManager: Contract;
    let aktionariatFactory: Contract;
    let factoryManagerOwner: HardhatEthersSigner;

    before(async function() {
      await switchForkedNetwork("optimism");
      ({ multiSigWalletMasterV6, multisigCloneFactory, factoryManager, aktionariatFactory } = await loadFixture(deployMultisigUpdateV6ModuleFixture));
  
      const factoryManagerOwnerAddress = await factoryManager.owner();
      factoryManagerOwner = await getImpersonatedSigner(factoryManagerOwnerAddress);
      await factoryManager.connect(factoryManagerOwner).setMultiSigCloneFactory(multisigCloneFactory);
  
      expect(await aktionariatFactory.manager()).to.equal(factoryManager);
      expect(await factoryManager.multisigFactory()).to.equal(multisigCloneFactory);
    });

    it("Deployed address should match predicted address", async function () {
      const saltBytes = solidityPackedKeccak256(["string", "string"], [testSymbol, testSalt]);

      const predictedMultisigMainnet = await multisigCloneFactory.predict(saltBytes);
      const simulatedMultisigMainnet = await aktionariatFactory.createMultisig.staticCall(factoryManagerOwner, testSymbol, testSalt);

      await aktionariatFactory.connect(factoryManagerOwner).createMultisig(factoryManagerOwner, testSymbol, testSalt);
      const deployedMultisigMainnet = await ethers.getContractAt("MultiSigWalletMaster", simulatedMultisigMainnet);

      expect(await deployedMultisigMainnet.VERSION()).to.equal(6);
      expect(deployedMultisigMainnet).to.equal(predictedMultisigMainnet);

      deploymentAddressMainnet = simulatedMultisigMainnet;

      console.log(await hre.network.provider.send('eth_chainId'));
    });
  });
});