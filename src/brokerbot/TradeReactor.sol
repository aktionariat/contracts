// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {SignatureTransfer} from "../lib/SignatureTransfer.sol";
import {ISignatureTransfer} from "../lib/ISignatureTransfer.sol";
import {IERC20Permit} from "../ERC20/IERC20Permit.sol";
import {IERC20} from "../ERC20/IERC20.sol";
import {Intent, IntentHash} from "../lib/IntentHash.sol";
import {PaymentHub} from "./PaymentHub.sol";
import {IBrokerbot} from "./IBrokerbot.sol";
import {console} from "hardhat/console.sol";

contract TradeReactor {

    using IntentHash for Intent;

    error OfferTooLow();
    error InvalidFiller();
    error TokenMismatch();

    // copied from brokerbot for compatibility
    event Trade(address seller, address buyer, address indexed token, uint amount, address currency, uint price, uint fee);

    // event IntentSignal(address owner, address filler, address tokenOut, uint160 amountOut, address tokenIn, uint160 amountIn, uint48 exp, uint48 nonce, bytes signature);
    event IntentSignal(address owner, address filler, address tokenOut, uint160 amountOut, address tokenIn, uint160 amountIn, uint48 exp, uint48 nonce, bytes data, bytes signature);

    SignatureTransfer immutable public transfer;

    constructor(SignatureTransfer _transfer){
        transfer = _transfer;
    }

    /**
     * A function to publicly signal an intent to buy or sell a token so it can be picked up by the filler for processing.
     * Alternaticely, the owner can directly communicate with the filler, without recording the intent on chain.
     */
    function signalIntent(Intent calldata intent, bytes calldata signature) public {
        // emit IntentSignal(intent.owner, intent.filler, intent.tokenOut, intent.amountOut, intent.tokenIn, intent.amountIn, intent.expiration, intent.nonce, signature);
        emit IntentSignal(intent.owner, intent.filler, intent.tokenOut, intent.amountOut, intent.tokenIn, intent.amountIn, intent.expiration, intent.nonce, intent.data, signature);
    }

    /**
     * Ideally called with an intent where tokenIn is a currency with many (e.g. 18) decimals.
     * TokenOut can have very few decimals.
     */
    function getAsk(Intent calldata intent, uint256 amount) public pure returns (uint256) {
        // We should make sure that the rounding is always for the benefit of the intent owner to prevent exploits
        // Example: when the seller offers to sell 7 ABC for 10 CHF, the accurate price would be 4.2857....
        // The naive approach to calculate the same price using integers would be 3 * 10 / 7 = 3
        // But with the given approach, we get 10 - (7 - 3) * 10 / 7 = 5, which is higher than tha accurate price.
        return intent.amountIn - intent.amountIn * (intent.amountOut - amount) / intent.amountOut;
    }

    /**
     * Ideally called with an intent where tokenOut is a currency with many (e.g. 18) decimals.
     * TokenIn can have very few decimals.
     */
    function getBid(Intent calldata intent, uint256 amount) public pure returns (uint256) {
        // We should make sure that the rounding is always for the benefit of the intent owner to prevent exploits
        // Example: when the buyer offers to buy 7 ABC for 10 CHF, but only 3 can be filled, the accurate price would be 4.2857....
        // With this calculation, we get a rounded down bid of 10 * 3 / 7 = 4
        return intent.amountOut * amount / intent.amountIn;
    }

    function getMaxValidAmount(Intent calldata sellerIntent, Intent calldata buyerIntent) public view returns (uint256) {
        uint256 sellerAvailable = transfer.getPermittedAmount(sellerIntent.owner, toPermit(sellerIntent));
        uint256 buyerAvailable = transfer.getPermittedAmount(buyerIntent.owner, toPermit(buyerIntent));
        uint256 biddingFor = buyerIntent.amountIn * buyerAvailable / buyerIntent.amountOut;
        uint256 maxAmount = biddingFor > sellerAvailable ? sellerAvailable : biddingFor;
        uint256 ask = getAsk(sellerIntent, maxAmount);
        uint256 bid = getBid(buyerIntent, maxAmount);
        if (bid < ask) revert OfferTooLow();
        return maxAmount;
    }

    function process(address feeRecipient, Intent calldata sellerIntent, bytes calldata sellerSig, Intent calldata buyerIntent, bytes calldata buyerSig) public {
        process(feeRecipient, sellerIntent, sellerSig, buyerIntent, buyerSig, getMaxValidAmount(sellerIntent, buyerIntent));
    }

    function process(address feeRecipient, Intent calldata sellerIntent, bytes calldata sellerSig, Intent calldata buyerIntent, bytes calldata buyerSig, uint256 amount) public {
        // signatures will be verified in SignatureTransfer
        if (sellerIntent.tokenOut != buyerIntent.tokenIn || sellerIntent.tokenIn != buyerIntent.tokenOut) revert TokenMismatch();
        if (sellerIntent.filler != address(0x0) && sellerIntent.filler != msg.sender) revert InvalidFiller();
        if (buyerIntent.filler != address(0x0) && buyerIntent.filler != msg.sender) revert InvalidFiller();
        uint256 ask = getAsk(sellerIntent, amount);
        uint256 bid = getBid(buyerIntent, amount);
        if (bid < ask) revert OfferTooLow();
        // move tokens to reactor in order to implicitly allowlist target address in case reactor is powerlisted
        transfer.permitWitnessTransferFrom(toPermit(sellerIntent), toDetails(address(this), amount), sellerIntent.owner, sellerIntent.hash(), IntentHash.PERMIT2_INTENT_TYPE, sellerSig);
        transfer.permitWitnessTransferFrom(toPermit(buyerIntent), toDetails(address(this), bid), buyerIntent.owner, buyerIntent.hash(), IntentHash.PERMIT2_INTENT_TYPE, buyerSig);
        // move tokens to target addresses
        IERC20(sellerIntent.tokenOut).transfer(buyerIntent.owner, amount);
        IERC20(sellerIntent.tokenIn).transfer(sellerIntent.owner, ask);
        IERC20(sellerIntent.tokenIn).transfer(feeRecipient, bid - ask); // collect spread as fee
        emit Trade(sellerIntent.owner, buyerIntent.owner, sellerIntent.tokenOut, amount, sellerIntent.tokenIn, ask, bid - ask);
    }

    function buyFromBrokerbot(IBrokerbot bot, Intent calldata intent, bytes calldata signature, uint256 amount) public returns (uint256) {
        return buyFromBrokerbot(PaymentHub(payable(bot.paymenthub())), bot, intent, signature, amount);
    }

    function buyFromBrokerbot(PaymentHub hub, IBrokerbot bot, Intent calldata intent, bytes calldata signature, uint256 investAmount) public returns (uint256) {
        transfer.permitTransferFrom(toPermit(intent), toDetails(address(this), investAmount), intent.owner, signature);
        IERC20(intent.tokenOut).approve(address(hub), investAmount);
        // uint256 received = hub.payAndNotify(bot, investAmount, "");
        uint256 received = hub.payAndNotify(bot, investAmount, intent.data);
        if (investAmount > getBid(intent, received)) revert OfferTooLow();
        return received;
    }

    function sellToBrokerbot(IBrokerbot bot, Intent calldata intent, bytes calldata signature, uint256 soldShares)public returns (uint256) {
        return sellToBrokerbot(PaymentHub(payable(bot.paymenthub())), bot, intent, signature, soldShares);
    }

    function sellToBrokerbot(PaymentHub hub, IBrokerbot bot, Intent calldata intent, bytes calldata signature, uint256 soldShares) public returns (uint256) {
        transfer.permitTransferFrom(toPermit(intent), toDetails(address(this), soldShares), intent.owner, signature);
        IERC20(intent.tokenOut).approve(address(hub), soldShares);
        // uint256 received = hub.payAndNotify(bot, soldShares, "");
        uint256 received = hub.payAndNotify(bot, soldShares, intent.data);
        if (received < getAsk(intent, received)) revert OfferTooLow();
        return received;
    }

    function toDetails(address recipient, uint256 amount) internal pure returns (ISignatureTransfer.SignatureTransferDetails memory){
        return ISignatureTransfer.SignatureTransferDetails({to: recipient, requestedAmount: amount});
    }
 
    function toPermit(Intent memory intent) internal pure returns (ISignatureTransfer.PermitTransferFrom memory) {
        return ISignatureTransfer.PermitTransferFrom({
            permitted: ISignatureTransfer.TokenPermissions({
                token: address(intent.tokenOut),
                amount: intent.amountOut
            }),
            nonce: intent.nonce,
            deadline: intent.expiration
        });
    }

}