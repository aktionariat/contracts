import { expect } from "chai";
import { signer1, signer2 } from "./TestBase.ts";
import {
  deployBridgeFixture,
  lockSourceAndMintDest,
  burnDestAndReleaseSource,
  type BridgeFixture,
} from "./FactoryFixture.ts";

describe("FactoryTokenBridge (factory deployment + CCIP bridging)", function () {
  let f: BridgeFixture;

  before(async () => {
    f = await deployBridgeFixture();
  });

  it("Lock SHA on source chain and mint BSHA on destination chain", async () => {
    const signer1Addr = await signer1.getAddress();
    const signer2Addr = await signer2.getAddress();
    const amount = 100n;

    // Transfer SHA to the LockRelease pool
    await f.sha
      .connect(signer1)
      .approve(await f.lockReleasePool.getAddress(), amount);
    await f.sha
      .connect(signer1)
      .transfer(await f.lockReleasePool.getAddress(), amount);
    expect(
      await f.sha.balanceOf(await f.lockReleasePool.getAddress())
    ).to.equal(amount);

    await lockSourceAndMintDest(f, signer1Addr, signer2Addr, amount);

    expect(await f.bsha.balanceOf(signer2Addr)).to.equal(amount);
    expect(
      await f.sha.balanceOf(await f.lockReleasePool.getAddress())
    ).to.equal(amount);
  });

  it("Burn BSHA on destination chain and release SHA on source chain", async () => {
    const signer1Addr = await signer1.getAddress();
    const signer2Addr = await signer2.getAddress();
    const amount = 50n;

    // Transfer BSHA to the BurnMint pool
    // should be to the router, but we talk directly to the token pool
    await f.bsha
      .connect(signer2)
      .approve(await f.burnMintPool.getAddress(), amount);
    await f.bsha
      .connect(signer2)
      .transfer(await f.burnMintPool.getAddress(), amount);
    expect(await f.bsha.balanceOf(await f.burnMintPool.getAddress())).to.equal(
      amount
    );

    await burnDestAndReleaseSource(f, signer2Addr, signer1Addr, amount);

    expect(await f.bsha.balanceOf(await f.burnMintPool.getAddress())).to.equal(
      0n
    );
    expect(await f.sha.balanceOf(signer1Addr)).to.equal(100n + amount);
    expect(
      await f.sha.balanceOf(await f.lockReleasePool.getAddress())
    ).to.equal(100n - amount);
  });
});
