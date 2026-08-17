import { expect } from "chai";
import { ethers, owner } from "./TestBase.ts";
import { setBalance } from "../scripts/helpers/setBalance.ts";

import {
  MockCCIPRouter,
  MultiSigWalletMaster,
} from "../types/ethers-contracts/index.ts";

// Test that MultichainWallet.sync correctly tracks fees across all overloads,
// handles overpayment refunds, and works with both native ETH and fee tokens.

const FEE = ethers.parseEther("0.01");
const WALLET_FUND = ethers.parseEther("100");
const TOKEN_MINT = ethers.parseEther("10");

// Arbitrary chain selectors used as distinct targets
const CHAIN_A = 11155111n; // sepolia
const CHAIN_B = 80002n; // amoy
const CHAIN_C = 43113n; // fuji

// Overload signatures
const SYNC_BATCH = "sync(uint64[],address[],address)";
const SYNC_SINGLE_LIST_FEE = "sync(uint64,address[],address)";

async function deployFixture(): Promise<{
  mockRouter: MockCCIPRouter;
  clone: MultiSigWalletMaster;
  ownerAddr: string;
}> {
  const MockCCIPRouter = await ethers.getContractFactory(
    "contracts/mocks/MockCCIPRouter.sol:MockCCIPRouter"
  );
  const mockRouter = await MockCCIPRouter.deploy();
  await mockRouter.waitForDeployment();
  await mockRouter.setFee(FEE);

  const ArgSource = await ethers.getContractFactory(
    "contracts/multisig/MultichainWalletArgumentSource.sol:MultichainWalletArgumentSource"
  );
  const argSource = await ArgSource.deploy();
  await argSource.waitForDeployment();
  await argSource.initialize(await mockRouter.getAddress());

  const Master = await ethers.getContractFactory(
    "contracts/multisig/MultiSigWalletMaster.sol:MultiSigWalletMaster"
  );
  const master = await Master.deploy(await argSource.getAddress());
  await master.waitForDeployment();

  const Factory = await ethers.getContractFactory(
    "contracts/multisig/MultiSigCloneFactory.sol:MultiSigCloneFactory"
  );
  const factory = await Factory.deploy(await master.getAddress());
  await factory.waitForDeployment();

  const salt = ethers.encodeBytes32String("test-salt");
  const predicted = await factory.predict(salt);
  await factory.create(await owner.getAddress(), salt);

  const clone = await ethers.getContractAt(
    "contracts/multisig/MultiSigWalletMaster.sol:MultiSigWalletMaster",
    predicted
  );
  await setBalance(predicted, WALLET_FUND);
  await setBalance(await owner.getAddress(), WALLET_FUND);

  return { mockRouter, clone, ownerAddr: await owner.getAddress() } as any as {
    mockRouter: MockCCIPRouter;
    clone: MultiSigWalletMaster;
    ownerAddr: string;
  };
}

async function deployFeeFixture() {
  const base = await deployFixture();

  const MockFeeToken = await ethers.getContractFactory(
    "contracts/mocks/MockFeeToken.sol:MockFeeToken"
  );
  const feeToken = await MockFeeToken.deploy();
  await feeToken.waitForDeployment();

  const feeTokenAddr = await feeToken.getAddress();
  await feeToken.mint(base.ownerAddr, TOKEN_MINT);
  await feeToken
    .connect(owner)
    .approve(await base.clone.getAddress(), ethers.MaxUint256);

  return { ...base, feeToken, feeTokenAddr };
}

// // Native
describe("Multisig Native", function () {
  describe("sync batch", function () {
    it("does not drain wallet with exaggerated fee", async function () {
      const { mockRouter, clone, ownerAddr } = await deployFixture();

      const walletAddr = await clone.getAddress();
      const walletBalanceBefore = await ethers.provider.getBalance(walletAddr);
      const ownerBalanceBefore = await ethers.provider.getBalance(ownerAddr);

      const targets = [CHAIN_A, CHAIN_B, CHAIN_C];
      const signerList = [ownerAddr];
      const totalFee = FEE * 3n;
      const exaggeratedFee = ethers.parseEther("1");

      await clone
        .connect(owner)
        [SYNC_BATCH](targets, signerList, ethers.ZeroAddress, {
          value: exaggeratedFee,
        });

      expect(await mockRouter.totalFeesCollected()).to.equal(totalFee);

      // Multisig native balance is unchanged
      expect(await ethers.provider.getBalance(walletAddr)).to.equal(
        walletBalanceBefore
      );

      // Owner paid totalFee and gas
      const ownerCost =
        ownerBalanceBefore - (await ethers.provider.getBalance(ownerAddr));
      expect(ownerCost).to.be.greaterThan(totalFee);
      expect(ownerCost).to.be.lessThan(exaggeratedFee);
    });

    it("reverts on insufficient msg.value", async function () {
      const { clone, ownerAddr } = await deployFixture();

      const targets = [CHAIN_A, CHAIN_B, CHAIN_C];
      const signerList = [ownerAddr];
      const insufficient = FEE * 2n;

      await expect(
        clone
          .connect(owner)
          [SYNC_BATCH](targets, signerList, ethers.ZeroAddress, {
            value: insufficient,
          })
      ).to.be.revertedWithCustomError(clone, "InsufficientNativeFeeToken");
    });

    it("single target in batch works correctly", async function () {
      const { mockRouter, clone, ownerAddr } = await deployFixture();

      const walletAddr = await clone.getAddress();
      const walletBalanceBefore = await ethers.provider.getBalance(walletAddr);

      await clone
        .connect(owner)
        [SYNC_BATCH]([CHAIN_A], [ownerAddr], ethers.ZeroAddress, {
          value: FEE,
        });

      expect(await mockRouter.totalFeesCollected()).to.equal(FEE);
      expect(await ethers.provider.getBalance(walletAddr)).to.equal(
        walletBalanceBefore
      );
    });

    it("single target overpays and refunds", async function () {
      const { mockRouter, clone, ownerAddr } = await deployFixture();

      const overpayment = FEE * 3n;
      const walletAddr = await clone.getAddress();
      const walletBalanceBefore = await ethers.provider.getBalance(walletAddr);
      const callerBalanceBefore = await ethers.provider.getBalance(ownerAddr);

      await clone
        .connect(owner)
        [SYNC_BATCH]([CHAIN_A], [ownerAddr], ethers.ZeroAddress, {
          value: overpayment,
        });

      expect(await mockRouter.totalFeesCollected()).to.equal(FEE);
      expect(await ethers.provider.getBalance(walletAddr)).to.equal(
        walletBalanceBefore
      );

      const callerBalanceAfter = await ethers.provider.getBalance(ownerAddr);
      const callerNetCost = callerBalanceBefore - callerBalanceAfter;
      expect(callerNetCost).to.be.lessThan(overpayment);
      expect(callerNetCost).to.be.greaterThan(FEE);
    });
  });

  describe("sync single", function () {
    it("works correctly", async function () {
      const { mockRouter, clone, ownerAddr } = await deployFixture();

      const walletAddr = await clone.getAddress();
      const walletBalanceBefore = await ethers.provider.getBalance(walletAddr);

      await clone
        .connect(owner)
        [SYNC_SINGLE_LIST_FEE](CHAIN_A, [ownerAddr], ethers.ZeroAddress, {
          value: FEE,
        });

      expect(await mockRouter.totalFeesCollected()).to.equal(FEE);
      expect(await ethers.provider.getBalance(walletAddr)).to.equal(
        walletBalanceBefore
      );
    });

    it("overpays and refunds", async function () {
      const { mockRouter, clone, ownerAddr } = await deployFixture();

      const overpayment = FEE * 3n;
      const walletAddr = await clone.getAddress();
      const walletBalanceBefore = await ethers.provider.getBalance(walletAddr);
      const callerBalanceBefore = await ethers.provider.getBalance(ownerAddr);

      await clone
        .connect(owner)
        [SYNC_SINGLE_LIST_FEE](CHAIN_A, [ownerAddr], ethers.ZeroAddress, {
          value: overpayment,
        });

      expect(await mockRouter.totalFeesCollected()).to.equal(FEE);
      expect(await ethers.provider.getBalance(walletAddr)).to.equal(
        walletBalanceBefore
      );

      const callerBalanceAfter = await ethers.provider.getBalance(ownerAddr);
      const callerNetCost = callerBalanceBefore - callerBalanceAfter;
      expect(callerNetCost).to.be.lessThan(overpayment);
      expect(callerNetCost).to.be.greaterThan(FEE);
    });

    it("reverts on insufficient msg.value", async function () {
      const { clone, ownerAddr } = await deployFixture();

      await expect(
        clone
          .connect(owner)
          [SYNC_SINGLE_LIST_FEE](CHAIN_A, [ownerAddr], ethers.ZeroAddress, {
            value: 0,
          })
      ).to.be.revertedWithCustomError(clone, "InsufficientNativeFeeToken");
    });
  });
});

// // Fee token
describe("Multisig Fee", function () {
  describe("sync batch", function () {
    it("pays with exact token amount", async function () {
      const { mockRouter, clone, ownerAddr, feeToken, feeTokenAddr } =
        await deployFeeFixture();

      const walletAddr = await clone.getAddress();
      const walletBalanceBefore = await ethers.provider.getBalance(walletAddr);

      const targets = [CHAIN_A, CHAIN_B, CHAIN_C];
      const signerList = [ownerAddr];
      const totalFee = FEE * 3n;

      // No native value
      await clone
        .connect(owner)
        [SYNC_BATCH](targets, signerList, feeTokenAddr, { value: 0 });
      expect(await mockRouter.totalFeesCollected()).to.equal(totalFee);

      // Multisig native balance unchanged
      expect(await ethers.provider.getBalance(walletAddr)).to.equal(
        walletBalanceBefore
      );

      // Multisig gained the fee tokens as the router mock doesn't transfer them away
      expect(await feeToken.balanceOf(walletAddr)).to.equal(totalFee);
      // Owner paid the fee tokens
      expect(await feeToken.balanceOf(ownerAddr)).to.equal(
        TOKEN_MINT - totalFee
      );
    });

    it("single target works correctly", async function () {
      const { mockRouter, clone, ownerAddr, feeToken, feeTokenAddr } =
        await deployFeeFixture();

      const walletAddr = await clone.getAddress();
      const walletBalanceBefore = await ethers.provider.getBalance(walletAddr);

      await clone
        .connect(owner)
        [SYNC_BATCH]([CHAIN_A], [ownerAddr], feeTokenAddr, { value: 0 });

      expect(await mockRouter.totalFeesCollected()).to.equal(FEE);
      expect(await ethers.provider.getBalance(walletAddr)).to.equal(
        walletBalanceBefore
      );
      expect(await feeToken.balanceOf(walletAddr)).to.equal(FEE);
      expect(await feeToken.balanceOf(ownerAddr)).to.equal(TOKEN_MINT - FEE);
    });

    it("reverts on insufficient token balance", async function () {
      const { clone, ownerAddr, feeToken, feeTokenAddr } =
        await deployFeeFixture();
      // Get signer without token balance
      const signers = await ethers.getSigners();
      const signer3 = signers[3];
      const signer3Addr = await signer3.getAddress();
      await setBalance(signer3Addr, WALLET_FUND);

      await expect(
        clone
          .connect(signer3)
          [SYNC_BATCH]([CHAIN_A], [signer3Addr], feeTokenAddr, { value: 0 })
      ).to.be.revertedWithCustomError(feeToken, "ERC20InsufficientAllowance");
    });
  });

  describe("sync single", function () {
    it("pays with exact token amount", async function () {
      const { mockRouter, clone, ownerAddr, feeToken, feeTokenAddr } =
        await deployFeeFixture();

      const walletAddr = await clone.getAddress();
      const walletBalanceBefore = await ethers.provider.getBalance(walletAddr);

      await clone
        .connect(owner)
        [SYNC_SINGLE_LIST_FEE](CHAIN_A, [ownerAddr], feeTokenAddr, {
          value: 0,
        });

      expect(await mockRouter.totalFeesCollected()).to.equal(FEE);
      expect(await ethers.provider.getBalance(walletAddr)).to.equal(
        walletBalanceBefore
      );
      expect(await feeToken.balanceOf(walletAddr)).to.equal(FEE);
      expect(await feeToken.balanceOf(ownerAddr)).to.equal(TOKEN_MINT - FEE);
    });

    it("reverts on insufficient token balance", async function () {
      const { mockRouter, clone, ownerAddr, feeToken, feeTokenAddr } =
        await deployFeeFixture();

      const signers = await ethers.getSigners();
      const signer3 = signers[3];
      const signer3Addr = await signer3.getAddress();
      await setBalance(signer3Addr, WALLET_FUND);

      await expect(
        clone
          .connect(signer3)
          [SYNC_SINGLE_LIST_FEE](CHAIN_A, [signer3Addr], feeTokenAddr, {
            value: 0,
          })
      ).to.be.revertedWithCustomError(feeToken, "ERC20InsufficientAllowance");
    });
  });
});
