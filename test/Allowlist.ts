import { expect } from "chai";
import { Contract } from "ethers";
import { connection, ethers, owner, signer1, signer2, signer3 } from "./TestBase.ts";
import { deployFixture, mintAndWrap } from "./Fixtures.ts";

// Allowlist behaviour shared by every token built on contracts/ERC20/ERC20Allowlistable.sol,
// exercised here on the SharesUnderAgreement wrapper.

const RECOVERY_DELAY = 184n * 24n * 60n * 60n; // 184 days in seconds

describe("Allowlist (ERC20Allowlistable)", function () {
  let shares: Contract;
  let sua: Contract;

  beforeEach(async () => {
    ({ shares, sharesUnderAgreement: sua } = await deployFixture());
    await mintAndWrap(shares, sua, await signer1.getAddress(), 100n);
  });

  it("keeps address zero free after the owner burns from an admin holder", async () => {
    expect(await sua.defaultType()).to.equal(await sua.TYPE_FREE());
    await sua.connect(owner)["setType(address,uint8)"](signer1, await sua.TYPE_ADMIN());

    // Recoverable.burn: hook sees from=signer1 (ADMIN), to=address(0)
    await sua.connect(owner).initBurn(signer1);
    await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
    await sua.connect(owner)["burn(address,uint256)"](signer1, 40n);
    expect(await sua.balanceOf(signer1)).to.equal(60n);

    expect(await sua.isAllowed(ethers.ZeroAddress)).to.equal(false);
    expect(await sua.defaultType()).to.equal(await sua.TYPE_FREE());

    // new holders can still be minted/wrapped and land in the free tier
    await mintAndWrap(shares, sua, await signer2.getAddress(), 25n);
    expect(await sua.balanceOf(signer2)).to.equal(25n);
    expect(await sua.isAllowed(signer2)).to.equal(false);

    // a real admin transfer still allowlists the recipient
    await sua.connect(signer1).transfer(signer3, 10n);
    expect(await sua.isAllowed(signer3)).to.equal(true);
  });

  it("does not allowlist the recipient of a zero-value transferFrom from an admin", async () => {
    await sua.connect(owner)["setType(address,uint8)"](signer1, await sua.TYPE_ADMIN());
    // anyone can call transferFrom with amount 0: no allowance is consumed
    await sua.connect(signer2).transferFrom(signer1, signer3, 0n);
    expect(await sua.isAllowed(signer3)).to.equal(false);
  });
});
