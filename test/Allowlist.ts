import { expect } from "chai";
import { Contract } from "ethers";
import { connection, ethers, owner, provider, signer1, signer2, signer3 } from "./TestBase.ts";
import { deployFixture, mintAndWrap } from "./Fixtures.ts";
import { getSignature } from "./Intent.ts";
import { setZCHFBalance } from "../scripts/helpers/setBalance.ts";

// Allowlist behaviour shared by every token built on contracts/ERC20/ERC20Allowlistable.sol,
// exercised here on the SharesUnderAgreement wrapper.

const RECOVERY_DELAY = 184n * 24n * 60n * 60n; // 184 days in seconds

describe("Allowlist (ERC20Allowlistable)", function () {
  let shares: Contract;
  let sua: Contract;
  let tradeReactor: Contract;
  let zchf: Contract;

  beforeEach(async () => {
    ({ shares, sharesUnderAgreement: sua, tradeReactor, zchf } = await deployFixture());
    await mintAndWrap(shares, sua, await signer1.getAddress(), 100n);
  });

  describe("restricted holders", function () {
    // The wrapper, the reactor and the token pools are typed ADMIN so that they can forward tokens to
    // anyone. A restricted holder must not be able to use them as an exit: the only recipient it can
    // send to is the owner.

    it("cannot wrap base shares through the ADMIN wrapper", async () => {
      await shares.connect(owner).mint(signer2, 10n);
      await shares.connect(owner)["setType(address,uint8)"](sua, await shares.TYPE_ADMIN());
      await shares.connect(owner).freeze(signer2);
      await shares.connect(signer2).approve(sua, 10n);
      await expect(sua.connect(signer2)["wrap(uint256)"](10n))
        .to.be.revertedWithCustomError(shares, "Allowlist_SenderIsForbidden").withArgs(signer2.address);
      // and cannot hand the base shares to anyone but the owner
      await expect(shares.connect(signer2).transfer(signer3, 1n)).to.revert(ethers);
      await shares.connect(signer2).transfer(owner, 10n);
      expect(await shares.balanceOf(owner)).to.equal(10n);
    });

    it("cannot sell through the ADMIN trade reactor", async () => {
      await sua.connect(owner)["setType(address,uint8)"](tradeReactor, await sua.TYPE_ADMIN());
      await sua.connect(owner).freeze(signer1);
      await sua.connect(signer1).approve(tradeReactor, 100n);
      // fund the buyer with exactly the trade price so the shared fork state is left as found
      await setZCHFBalance(signer2.address, ethers.parseUnits("100", 18));
      await zchf.connect(signer2).approve(tradeReactor, ethers.parseUnits("100", 18));

      const now = BigInt((await provider.request({ method: "eth_getBlockByNumber", params: ["latest", false] }) as any).timestamp);
      const reactorAddress = await tradeReactor.getAddress();
      const common = { filler: ethers.ZeroAddress, creation: now, expiration: now + 3600n, data: "0x" };
      const sellerIntent = { ...common, owner: signer1.address, tokenOut: await sua.getAddress(), amountOut: 10n, tokenIn: await zchf.getAddress(), amountIn: ethers.parseUnits("100", 18) };
      const buyerIntent = { ...common, owner: signer2.address, tokenOut: await zchf.getAddress(), amountOut: ethers.parseUnits("100", 18), tokenIn: await sua.getAddress(), amountIn: 10n };
      const sellerSig = await getSignature(signer1, sellerIntent, reactorAddress);
      const buyerSig = await getSignature(signer2, buyerIntent, reactorAddress);

      await expect(tradeReactor.process(sellerIntent, sellerSig, buyerIntent, buyerSig, 10n, 0n))
        .to.be.revertedWithCustomError(sua, "Allowlist_SenderIsForbidden").withArgs(signer1.address);

      // the same trade settles once the seller is unfrozen
      await sua.connect(owner).unfreeze(signer1);
      await tradeReactor.process(sellerIntent, sellerSig, buyerIntent, buyerSig, 10n, 0n);
      expect(await sua.balanceOf(signer2)).to.equal(10n);
    });
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

  describe("unwrap", function () {
    const MIGRATION_DELAY = 20n * 24n * 60n * 60n;

    beforeEach(async () => {
      // terminate the agreement so that unwrap is available
      await sua.connect(owner).proposeTermination();
      await connection.networkHelpers.time.increase(MIGRATION_DELAY + 1n);
      await sua.connect(owner).executeMigration();
      expect(await sua.binding()).to.equal(false);
    });

    it("lets an allowlisted holder unwrap while address zero is free", async () => {
      await sua.connect(owner)["setType(address,uint8)"](signer1, await sua.TYPE_ALLOWED());
      expect(await sua.isAdmin(ethers.ZeroAddress)).to.equal(false);
      await sua.connect(signer1).unwrap(40n);
      expect(await sua.balanceOf(signer1)).to.equal(60n);
      expect(await shares.balanceOf(signer1)).to.equal(40n);
    });

    it("does not let a frozen holder unwrap", async () => {
      await sua.connect(owner).freeze(signer1);
      await expect(sua.connect(signer1).unwrap(40n))
        .to.be.revertedWithCustomError(sua, "Allowlist_SenderIsForbidden").withArgs(signer1.address);
    });
  });
});
