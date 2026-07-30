// /**
//  * Local tests for the CCIP infrastructure and realted Aktionariat contracts for
//  * transfers logic. It uses packages:
//  *
//  * "@chainlink/contracts-ccip": "^1.6.3",
//  * "@chainlink/local": "^0.2.9",
//  *
//  * Note that the last released CCIP package of v2.0.0 is incompatible with the
//  * latest @chainlink/local release, as such we reverted to use the last non-breaking
//  * ccip release namely, v1.6.3.
//  *
//  * Even if documents for local simulator (https://docs.chain.link/chainlink-local/build/ccip/hardhat/local-simulator)
//  * show to use v0.2.7-beta and for ccip (https://docs.chain.link/ccip/api-reference/evm/v1.6.1)
//  * they say latest v1.6.1. The testing suite from chainlink is probably not up
//  * to date.
//  *
//  * Along with local testing we aim to provide also live testnet tests. To ensure
//  * that code is functioning correctly, since Chainlink Local does simulate the
//  * source and destination infrastructure on a single chain. Testnet tests will
//  * mimic current local tests. Tests have to be run manually, they are supported
//  * by utils within `tasks`, see `docs/CCIP.md` for more information about implemented
//  * tasks.
//  */

// import { expect } from "chai";
// import { network } from "hardhat";

// import type { NetworkConnection } from "hardhat/types/network";
// import type {
//   BridgedSharesUnderAgreement,
//   BurnMintTokenPool,
//   CCIPSender,
//   IERC20,
//   LockReleaseTokenPool,
//   Shares,
//   SharesUnderAgreement,
// } from "../types/ethers-contracts/index.ts";
// import type { Signer } from "ethers";

// describe("BridgedSharesUnderAgreement CCIP bridge (local simulator)", () => {
//   let owner: Signer;
//   let receiver: Signer;
//   const SHARES_AGREEMENT_DECIMALS = 0;
//   const SHARES_AGREEMENT_INIT_BALANCE = 100000;

//   let sharesToken: Shares;
//   let sharesAgreementToken: SharesUnderAgreement;

//   let ccipSender: CCIPSender;
//   let bridgedAgreementToken: BridgedSharesUnderAgreement;
//   let lockReleasePool: LockReleaseTokenPool;
//   let burnMintPool: BurnMintTokenPool;

//   let config: {
//     chainSelector_: bigint;
//     sourceRouter_: string;
//     destinationRouter_: string;
//     wrappedNative_: string;
//     linkToken_: string;
//     ccipBnM_: string;
//     ccipLnM_: string;
//   };
//   let connection: NetworkConnection;

//   before(async () => {
//     connection = await network.create("hardhatMainnet");
//     let ethers = connection.ethers;

//     [owner, receiver] = await ethers.getSigners();

//     const ccipLocalSimulator = await (
//       await ethers.getContractFactory("CCIPLocalSimulator")
//     ).deploy();
//     config = await ccipLocalSimulator.configuration();

//     // set router fee to arbitrary 0.01 of token
//     const routerAsIRouter = await ethers.getContractAt(
//       ["function setFee(uint256 feeAmount) external"],
//       config.sourceRouter_
//     );
//     await routerAsIRouter.setFee(ethers.parseEther("0.01"));

//     const rmnProxy = await (
//       await (await ethers.getContractFactory("MockRMNProxy")).deploy()
//     ).getAddress();

//     sharesToken = await (
//       await ethers.getContractFactory("Shares")
//     ).deploy("MSTR", "Microstrategy Shares", "T&C", await owner.getAddress());
//     sharesAgreementToken = await (
//       await ethers.getContractFactory("SharesUnderAgreement")
//     ).deploy(
//       await sharesToken.getAddress(),
//       "T&C",
//       SHARES_AGREEMENT_DECIMALS,
//       await owner.getAddress()
//     );
//     bridgedAgreementToken = await (
//       await ethers.getContractFactory("BridgedSharesUnderAgreement")
//     ).deploy(
//       "BMSTRS",
//       "Bridged Microstrategy Shares SHA",
//       "T&C",
//       await owner.getAddress()
//     );

//     lockReleasePool = await (
//       await ethers.getContractFactory("LockReleaseTokenPool")
//     ).deploy(
//       await sharesAgreementToken.getAddress(),
//       ethers.parseUnits(SHARES_AGREEMENT_DECIMALS.toString(), 0),
//       [],
//       rmnProxy,
//       true,
//       config.sourceRouter_
//     );
//     burnMintPool = await (
//       await ethers.getContractFactory("BurnMintTokenPool")
//     ).deploy(
//       await bridgedAgreementToken.getAddress(),
//       ethers.parseUnits(SHARES_AGREEMENT_DECIMALS.toString(), 0),
//       [],
//       rmnProxy,
//       config.destinationRouter_
//     );

//     // deploy sender contract
//     ccipSender = await (
//       await ethers.getContractFactory("CCIPSender")
//     ).deploy(config.sourceRouter_);

//     await bridgedAgreementToken.setPool(await burnMintPool.getAddress());

//     const abi = ethers.AbiCoder.defaultAbiCoder();
//     const noRateLimit = { isEnabled: false, capacity: 0n, rate: 0n };

//     await lockReleasePool.applyChainUpdates(
//       [],
//       [
//         {
//           remoteChainSelector: config.chainSelector_,
//           remotePoolAddresses: [
//             abi.encode(["address"], [await burnMintPool.getAddress()]),
//           ],
//           remoteTokenAddress: abi.encode(
//             ["address"],
//             [await bridgedAgreementToken.getAddress()]
//           ),
//           outboundRateLimiterConfig: noRateLimit,
//           inboundRateLimiterConfig: noRateLimit,
//         },
//       ]
//     );
//     await burnMintPool.applyChainUpdates(
//       [],
//       [
//         {
//           remoteChainSelector: config.chainSelector_,
//           remotePoolAddresses: [
//             abi.encode(["address"], [await lockReleasePool.getAddress()]),
//           ],
//           remoteTokenAddress: abi.encode(
//             ["address"],
//             [await sharesAgreementToken.getAddress()]
//           ),
//           outboundRateLimiterConfig: noRateLimit,
//           inboundRateLimiterConfig: noRateLimit,
//         },
//       ]
//     );

//     // Mintings
//     const amount = ethers.parseUnits(
//       SHARES_AGREEMENT_INIT_BALANCE.toString(),
//       SHARES_AGREEMENT_DECIMALS
//     );

//     // mint some shares under agreement to owner
//     await sharesToken
//       .connect(owner)
//       .mintAndWrap(
//         await owner.getAddress(),
//         await sharesAgreementToken.getAddress(),
//         amount
//       );
//   });

//   it("should move token to receiver through CCIPSender", async () => {
//     let ethers = connection.ethers;

//     const destinationChainSelector = config.chainSelector_;
//     const addressReceiver = await receiver.getAddress();
//     const token = await sharesAgreementToken.getAddress();
//     const transferAmount = 10n;
//     const feeToken = ethers.ZeroAddress;
//     const data = ethers.toUtf8Bytes("");

//     // get fees to be paid for message
//     const fees = await ccipSender.getEstimatedFee(
//       destinationChainSelector,
//       addressReceiver,
//       token,
//       transferAmount,
//       feeToken,
//       data
//     );

//     // approve transfer by CCIPSender for owner
//     await sharesAgreementToken.approve(
//       await ccipSender.getAddress(),
//       transferAmount
//     );

//     // uint64 destinationChainSelector,
//     // address receiver,
//     // address token,
//     // uint256 amount,
//     // address feeToken,
//     // bytes memory data
//     const tx = await ccipSender
//       .connect(owner)
//       .sendToken(
//         destinationChainSelector,
//         addressReceiver,
//         token,
//         transferAmount,
//         feeToken,
//         data,
//         {
//           value: fees,
//         }
//       );

//     // Bridge Transfer succesfull modifies balances
//     // The CCIPLocalSimulator does not mimic exactly the behaviour
//     // of the CCIP infrastructure as it is a simple transfer from
//     // that moves token from the sender to the receiver
//     // sender
//     await expect(tx).to.be.changeTokenBalance(
//       ethers,
//       sharesAgreementToken,
//       owner,
//       -10n
//     );
//     // receiver
//     await expect(tx).to.be.changeTokenBalance(
//       ethers,
//       sharesAgreementToken,
//       receiver,
//       10n
//     );
//   });

//   it("should move token to receiver through CCIPSender and repay extra ether back", async () => {
//     let ethers = connection.ethers;

//     const destinationChainSelector = config.chainSelector_;
//     const addressReceiver = await receiver.getAddress();
//     const token = await sharesAgreementToken.getAddress();
//     const transferAmount = 10n;
//     const feeToken = ethers.ZeroAddress;
//     const data = ethers.toUtf8Bytes("");

//     // get fees to be paid for message
//     const fees = await ccipSender.getEstimatedFee(
//       destinationChainSelector,
//       addressReceiver,
//       token,
//       transferAmount,
//       feeToken,
//       data
//     );

//     // approve transfer by CCIPSender for owner
//     await sharesAgreementToken.approve(
//       await ccipSender.getAddress(),
//       transferAmount
//     );

//     // uint64 destinationChainSelector,
//     // address receiver,
//     // address token,
//     // uint256 amount,
//     // address feeToken,
//     // bytes memory data
//     const tx = await ccipSender
//       .connect(owner)
//       .sendToken(
//         destinationChainSelector,
//         addressReceiver,
//         token,
//         transferAmount,
//         feeToken,
//         data,
//         {
//           value: 2n * fees,
//         }
//       );

//     // fees should be addebited only once
//     await expect(tx).to.changeEtherBalance(ethers, owner, -fees);

//     // transfered token
//     // owner and receiver
//     await expect(tx).to.be.changeTokenBalances(
//       ethers,
//       sharesAgreementToken,
//       [owner, receiver],
//       [-10n, 10n]
//     );
//   });

//   it("should throw if not enough Native for fees", async () => {
//     let ethers = connection.ethers;

//     // Native
//     const destinationChainSelector = config.chainSelector_;
//     const addressReceiver = await receiver.getAddress();
//     const token = await sharesAgreementToken.getAddress();
//     const transferAmount = 10n;
//     const feeToken = ethers.ZeroAddress;
//     const data = ethers.toUtf8Bytes("");

//     // get fees to be paid for message
//     const fees = await ccipSender.getEstimatedFee(
//       destinationChainSelector,
//       addressReceiver,
//       token,
//       transferAmount,
//       feeToken,
//       data
//     );

//     // approve transfer by CCIPSender for owner
//     await sharesAgreementToken.approve(
//       await ccipSender.getAddress(),
//       transferAmount
//     );

//     // uint64 destinationChainSelector,
//     // address receiver,
//     // address token,
//     // uint256 amount,
//     // address feeToken,
//     // bytes memory data
//     await expect(
//       ccipSender
//         .connect(owner)
//         .sendToken(
//           destinationChainSelector,
//           addressReceiver,
//           token,
//           transferAmount,
//           feeToken,
//           data,
//           {
//             value: fees / 10n,
//           }
//         )
//     )
//       .to.be.revertedWithCustomError(ccipSender, "NotEnoughNativeToken")
//       .withArgs(fees, fees / 10n);
//   });

//   it("should pay with ERC20 and throw if you send Native", async () => {
//     // only some ERC20 are actually allowed, we use LINK to be sure
//     let ethers = connection.ethers;

//     const PATH_IERC20 = "contracts/ERC20/IERC20.sol:IERC20";
//     // Binance hot wallet
//     // if binance does not hold at least 100 LINK test might fail
//     const fundingAddress = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
//     const tokenAddress = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
//     const quantity = ethers.parseEther("100");

//     // we impersonate an address to fund owned addresses with tokenToTransfer for LINK
//     await connection.provider.request({
//       method: "hardhat_impersonateAccount",
//       params: [fundingAddress],
//     });
//     const imperFunder = await connection.ethers.getSigner(fundingAddress);

//     const feeToken: IERC20 = (await connection.ethers.getContractAt(
//       PATH_IERC20,
//       tokenAddress
//     )) as any as IERC20;

//     // transfter token to "to"
//     await feeToken
//       .connect(imperFunder)
//       .transfer(await owner.getAddress(), quantity);

//     // stop impersonating
//     await connection.provider.request({
//       method: "hardhat_stopImpersonatingAccount",
//       params: [fundingAddress],
//     });

//     // expect balance
//     expect(await feeToken.balanceOf(await owner.getAddress())).to.be.equal(
//       quantity
//     );

//     // make transfer
//     const destinationChainSelector = config.chainSelector_;
//     const addressReceiver = await receiver.getAddress();
//     const token = await sharesAgreementToken.getAddress();
//     const transferAmount = 10n;
//     const feeTokenAddress = await feeToken.getAddress();
//     const data = ethers.toUtf8Bytes("");

//     // get fees to be paid for message
//     const fees = await ccipSender.getEstimatedFee(
//       destinationChainSelector,
//       addressReceiver,
//       token,
//       transferAmount,
//       feeTokenAddress,
//       data
//     );

//     // approve transfer by CCIPSender for owner
//     // for sharestoken
//     await sharesAgreementToken.approve(
//       await ccipSender.getAddress(),
//       transferAmount
//     );
//     // for feeToken
//     await feeToken.approve(await ccipSender.getAddress(), fees);

//     // uint64 destinationChainSelector,
//     // address receiver,
//     // address token,
//     // uint256 amount,
//     // address feeToken,
//     // bytes memory data
//     const tx = await ccipSender
//       .connect(owner)
//       .sendToken(
//         destinationChainSelector,
//         addressReceiver,
//         token,
//         transferAmount,
//         feeTokenAddress,
//         data
//       );

//     // check balances
//     // owner and receiver
//     await expect(tx).to.be.changeTokenBalances(
//       ethers,
//       sharesAgreementToken,
//       [owner, receiver],
//       [-10n, 10n]
//     );
//     // owner and router LINK
//     await expect(tx).to.be.changeTokenBalances(
//       ethers,
//       feeToken,
//       [owner, config.sourceRouter_],
//       [-fees, fees]
//     );

//     // approvals again
//     await sharesAgreementToken.approve(
//       await ccipSender.getAddress(),
//       transferAmount
//     );
//     // for feeToken
//     await feeToken.approve(await ccipSender.getAddress(), fees);

//     // // throws if you try to send also Native
//     await expect(
//       ccipSender
//         .connect(owner)
//         .sendToken(
//           destinationChainSelector,
//           addressReceiver,
//           token,
//           transferAmount,
//           feeToken,
//           data,
//           {
//             value: 1n,
//           }
//         )
//     ).to.be.revertedWithCustomError(ccipSender, "DoNotSendNativePayment");
//   });

//   it("should move token to receiver pool by locking in lockOrBurn and minting from releaseOrMint via direct call", async () => {
//     /**
//      * instead of calling lockOrBurn and releaseOrMint directly, on testnet it will be:
//      *
//      * * * * * *
//      * User
//      *   |
//      *   | approve(pool)
//      *   |
//      * Sender Contract (via sendToken(...))
//      *   |
//      *   | approve(router)
//      *   | router.ccipSend{value: fee}(...)
//      *   |
//      *   v
//      * Router.ccipSend(...)
//      *   |
//      *   v
//      * OnRamp.forwardFromRouter(...)
//      *   |
//      *   v
//      * LockReleaseTokenPool.lockOrBurn(...) (deployed via Token pool factory on source chain)
//      *   |
//      *   v
//      * returns destTokenAddress + destPoolData;
//      * tx mines, message is now "committed" on source chain
//      *
//      * --- OFF-CHAIN — real CCIP network, NOT reproducible in a fork ---
//      *
//      * OffRamp.execute(reportContext, report)
//      *   |
//      *   v
//      * OffRamp._batchExecute(...)/executeSingleMessage(...)
//      *   |
//      *   v
//      * OffRamp._releaseOrMintTokens(...)/_releaseOrMintSingleToken(...)
//      *   |
//      *   | localPool = TokenAdminRegistry.getPool(localToken)
//      *   |
//      *   v
//      * BurnMintTokenPool.releaseOrMint(...) (deployed via Token pool factory on destination chain)
//      *   |
//      *   | IBurnMintERC20(bridgedToken).mint(receiver, amount)
//      *   |
//      *   v
//      * receiver balance += amount;
//      * BridgedSharesUnderAgreement minted to receiver
//      * * * * * *
//      *
//      * The impersonification is to make sure that, more than the LockReleasePool or CCIP behaviour
//      * that the actual destination contract, the BridgedSharesUnderAgreement has the correct interface
//      * that the BurnMintTokenPool needs.
//      */
//     let ethers = connection.ethers;
//     const abi = ethers.AbiCoder.defaultAbiCoder();

//     const lockReleasePoolAddr = await lockReleasePool.getAddress();
//     const sharesAgreementAddr = await sharesAgreementToken.getAddress();
//     const bridgedAddr = await bridgedAgreementToken.getAddress();
//     const ownerAddr = await owner.getAddress();
//     const receiverAddr = await receiver.getAddress();

//     // owner is funded
//     const amount = 10n;

//     // // // "Useless txns", here only to mimic the flow
//     // lockOrBurn checks msg.sender === router.getOnRamp(selector)
//     // at @chainlink/contracts-ccip/contracts/pools/TokenPool.sol line 674
//     // MockCCIPRouter always returns address(1234567890): so we impersonate it
//     // at @chainlink/local/src/vendor/chainlink-ccip/test/mocks/MockRouter.sol line 169
//     const IRouter =
//       "@chainlink/contracts-ccip/contracts/interfaces/IRouter.sol:IRouter";
//     const routerAsIRouter = await ethers.getContractAt(
//       IRouter,
//       config.sourceRouter_
//     );

//     // gives gas to onRamp
//     const onRampAddr = await routerAsIRouter.getOnRamp(config.chainSelector_);
//     await ethers.provider.send("hardhat_setBalance", [
//       onRampAddr,
//       // 100e18 eth
//       "0x56BC75E2D63100000",
//     ]);
//     const onRampSigner = await ethers.getImpersonatedSigner(onRampAddr);

//     // Here we mimic Router transfer
//     const preTransferTx = await sharesAgreementToken
//       .connect(owner)
//       .transfer(lockReleasePoolAddr, amount);
//     await expect(preTransferTx).to.changeTokenBalances(
//       ethers,
//       sharesAgreementToken,
//       [owner, lockReleasePool],
//       [-amount, amount]
//     );

//     // it is not transering tokens because it is a job of the Router to do so
//     const lockTx = await lockReleasePool.connect(onRampSigner).lockOrBurn({
//       receiver: abi.encode(["address"], [receiverAddr]),
//       remoteChainSelector: config.chainSelector_,
//       originalSender: ownerAddr,
//       amount,
//       localToken: sharesAgreementAddr,
//     });
//     // locked pool should hold the same amount of source chain tokens
//     await expect(lockTx)
//       .to.emit(lockReleasePool, "LockedOrBurned")
//       .withArgs(config.chainSelector_, sharesAgreementAddr, onRampAddr, amount);
//     // // //

//     // releaseOrMint is gated to router.isOffRamp, which this mock hardcodes to `true`
//     // so we don't need any impersonification to make the releaseOrMint call.
//     // at @chainlink/contracts-ccip/contracts/test/mocks/MockRouter.sol line 174
//     const sourcePoolData = abi.encode(["uint8"], [SHARES_AGREEMENT_DECIMALS]);
//     const tx = burnMintPool.connect(receiver).releaseOrMint({
//       originalSender: abi.encode(["address"], [ownerAddr]),
//       remoteChainSelector: config.chainSelector_,
//       receiver: receiverAddr,
//       sourceDenominatedAmount: amount,
//       localToken: bridgedAddr,
//       sourcePoolAddress: abi.encode(["address"], [lockReleasePoolAddr]),
//       sourcePoolData,
//       offchainTokenData: "0x",
//     });

//     // receiver should receive tokens
//     await expect(tx).to.changeTokenBalance(
//       ethers,
//       bridgedAgreementToken,
//       receiver,
//       amount
//     );
//     await expect(tx)
//       .to.emit(burnMintPool, "ReleasedOrMinted")
//       .withArgs(
//         config.chainSelector_,
//         bridgedAddr,
//         receiverAddr,
//         receiverAddr,
//         amount
//       );
//   });

//   it("actually unlocks back on the source pool by lockOrBurn", async () => {
//     let ethers = connection.ethers;
//     const abi = ethers.AbiCoder.defaultAbiCoder();

//     const lockReleasePoolAddr = await lockReleasePool.getAddress();
//     const sharesAgreementAddr = await sharesAgreementToken.getAddress();
//     const bridgedAddr = await bridgedAgreementToken.getAddress();
//     const ownerAddr = await owner.getAddress();
//     const receiverAddr = await receiver.getAddress();

//     // owner funded
//     const amount = 10n;

//     /**
//      * Forward Step: We simulate the bridging of sharesAgreementToken
//      *
//      * lockReleasePool: Locks shares to be bridged on src chain
//      * burnMintPool: Mints shares on dest chain
//      */

//     // lockOrBurn checks msg.sender === router.getOnRamp(selector)
//     // at @chainlink/contracts-ccip/contracts/pools/TokenPool.sol line 674
//     // MockCCIPRouter always returns address(1234567890): so we impersonate it
//     // at @chainlink/local/src/vendor/chainlink-ccip/test/mocks/MockRouter.sol line 169
//     const IRouter =
//       "@chainlink/contracts-ccip/contracts/interfaces/IRouter.sol:IRouter";
//     const routerAsIRouter = await ethers.getContractAt(
//       IRouter,
//       config.sourceRouter_
//     );
//     const onRampAddr = await routerAsIRouter.getOnRamp(config.chainSelector_);
//     await ethers.provider.send("hardhat_setBalance", [
//       onRampAddr,
//       "0x56BC75E2D63100000",
//     ]);
//     const onRampSigner = await ethers.getImpersonatedSigner(onRampAddr);

//     // // // "Useless txns", here only to mimic the flow
//     // here we mimic Router transfer
//     const preTransferTx = await sharesAgreementToken
//       .connect(owner)
//       .transfer(lockReleasePoolAddr, amount);
//     await expect(preTransferTx).to.changeTokenBalances(
//       ethers,
//       sharesAgreementToken,
//       [owner, lockReleasePool],
//       [-amount, amount]
//     );

//     const lockTx = await lockReleasePool.connect(onRampSigner).lockOrBurn({
//       receiver: abi.encode(["address"], [receiverAddr]),
//       remoteChainSelector: config.chainSelector_,
//       originalSender: ownerAddr,
//       amount,
//       localToken: sharesAgreementAddr,
//     });
//     await expect(lockTx)
//       .to.emit(lockReleasePool, "LockedOrBurned")
//       .withArgs(config.chainSelector_, sharesAgreementAddr, onRampAddr, amount);
//     // // //

//     // releaseOrMint on burnMintPool: mints fresh bridged tokens, no pre-funding needed
//     const sourcePoolData = abi.encode(["uint8"], [SHARES_AGREEMENT_DECIMALS]);
//     const mintTx = await burnMintPool.connect(receiver).releaseOrMint({
//       originalSender: abi.encode(["address"], [ownerAddr]),
//       remoteChainSelector: config.chainSelector_,
//       receiver: receiverAddr,
//       sourceDenominatedAmount: amount,
//       localToken: bridgedAddr,
//       sourcePoolAddress: abi.encode(["address"], [lockReleasePoolAddr]),
//       sourcePoolData,
//       offchainTokenData: "0x",
//     });
//     await expect(mintTx).to.changeTokenBalance(
//       ethers,
//       bridgedAgreementToken,
//       receiver,
//       amount
//     );

//     /**
//      * Backward Step: We simulate the bridging of sharesAgreementToken
//      *
//      * lockReleasePool: Unlocks and sends shares to receiver on src chain
//      * burnMintPool: Burns shares on src chain
//      */

//     // we transfer birdged shares to burnMintPool as it is the job of the
//     // router on destination chain, after we call CCIPSender
//     const preTransferBackTx = await bridgedAgreementToken
//       .connect(receiver)
//       .transfer(await burnMintPool.getAddress(), amount);
//     await expect(preTransferBackTx).to.changeTokenBalance(
//       ethers,
//       bridgedAgreementToken,
//       burnMintPool,
//       amount
//     );

//     // same as lockOrBurn from the lockReleasePool we impersonificate onRamp
//     // here tokens will be burned
//     const lockBackTx = await burnMintPool.connect(onRampSigner).lockOrBurn({
//       // returning to owner on mainnet
//       receiver: abi.encode(["address"], [ownerAddr]),
//       remoteChainSelector: config.chainSelector_,
//       originalSender: receiverAddr,
//       amount,
//       localToken: bridgedAddr,
//     });
//     // this time the balance change does happen inside lockOrBurn: it's a real burn,
//     // See at @chainlink/contracts-ccip/contracts/pools/BurnMintTokenPool.sol line 31
//     await expect(lockBackTx).to.changeTokenBalance(
//       ethers,
//       bridgedAgreementToken,
//       burnMintPool,
//       -amount
//     );
//     await expect(lockBackTx)
//       .to.emit(burnMintPool, "LockedOrBurned")
//       .withArgs(config.chainSelector_, bridgedAddr, onRampAddr, amount);

//     // the same way here offRamp always returns true
//     const releaseTx = await lockReleasePool.connect(receiver).releaseOrMint({
//       originalSender: abi.encode(["address"], [receiverAddr]),
//       remoteChainSelector: config.chainSelector_,
//       receiver: ownerAddr,
//       sourceDenominatedAmount: amount,
//       localToken: sharesAgreementAddr,
//       sourcePoolAddress: abi.encode(
//         ["address"],
//         [await burnMintPool.getAddress()]
//       ),
//       sourcePoolData: abi.encode(["uint8"], [SHARES_AGREEMENT_DECIMALS]),
//       offchainTokenData: "0x",
//     });

//     // and the transfer really happens: it's a real unlock,
//     // See at @chainlink/contracts-ccip/contracts/pools/LockReleaseTokenPool.sol line 39
//     await expect(releaseTx).to.changeTokenBalances(
//       ethers,
//       sharesAgreementToken,
//       [lockReleasePool, owner],
//       [-amount, amount]
//     );
//     await expect(releaseTx)
//       .to.emit(lockReleasePool, "ReleasedOrMinted")
//       .withArgs(
//         config.chainSelector_,
//         sharesAgreementAddr,
//         receiverAddr,
//         ownerAddr,
//         amount
//       );
//   });
// });
//
// TODO Now that contracts have been changed to onchain code, we need to
//      modify test to apply for that change
//
