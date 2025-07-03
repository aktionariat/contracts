// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import {SignatureTransfer} from "../lib/SignatureTransfer.sol";
import {ISignatureTransfer} from "../lib/ISignatureTransfer.sol";
import {IERC20Permit} from "../ERC20/IERC20Permit.sol";
import {IERC20} from "../ERC20/IERC20.sol";
import {Intent, IntentHash} from "../lib/IntentHash.sol";
import {PaymentHub} from "./PaymentHub.sol";
import {IBrokerbot} from "./IBrokerbot.sol";
import {SafeERC20} from "../utils/SafeERC20.sol";

/**
 * @title TradeReactor Contract
 * @notice This contract handles the signaling and processing of trade intents between buyers and sellers.
 * @dev This contract uses the SignatureTransfer contract for secure transfers with signatures.
*/
contract TradeReactor {

    using IntentHash for Intent;
    using SafeERC20 for IERC20;

    error TradeReactor_OfferTooLow();
    error TradeReactor_InvalidFiller();
    error TradeReactor_TokenMismatch();

    // copied from brokerbot for compatibility
    event Trade(address seller, address buyer, address indexed token, uint amount, address currency, uint price, uint fee);

    /// @dev Emitted when an intent to trade is signaled.
    /// @param owner The address of the intent owner.
    /// @param filler The address of the filler, if any, that the intent is specifically directed to.
    /// @param tokenOut The address of the token the owner wants to sell or exchange.
    /// @param amountOut The amount of the tokenOut the owner wants to sell or exchange.
    /// @param tokenIn The address of the token the owner wants to receive in exchange.
    /// @param amountIn The amount of the tokenIn the owner wants to receive.
    /// @param exp The expiration time of the intent.
    /// @param nonce A nonce to ensure the uniqueness of the intent.
    /// @param data Additional data that may be used in the trade execution.
    /// @param signature The signature of the owner authorizing the intent.
    event IntentSignal(address owner, address filler, address tokenOut, uint160 amountOut, address tokenIn, uint160 amountIn, uint48 exp, uint48 nonce, bytes data, bytes signature);

    SignatureTransfer immutable public transfer;

    constructor(SignatureTransfer _transfer){
        transfer = _transfer;
    }

    /**
     * @notice A function to publicly signal an intent to buy or sell a token so it can be picked up by the filler for processing.
     * Alternaticely, the owner can directly communicate with the filler, without recording the intent on chain.
     * @param intent The trade intent data structure. 
     * @param signature The signature of the intent owner.
    */
    function signalIntent(Intent calldata intent, bytes calldata signature) external {
        emit IntentSignal(intent.owner, intent.filler, intent.tokenOut, intent.amountOut, intent.tokenIn, intent.amountIn, intent.expiration, intent.nonce, intent.data, signature);
    }

    /**
     * @notice Calculates the asking price for a given amount of tokenOut.
     * @dev Ideally called with an intent where tokenIn is a currency with many (e.g. 18) decimals.
     * @dev TokenOut can have very few decimals.
     * @param intent The trade intent data structure.
     * @param amount The amount of tokenOut.
     * @return The calculated asking price.
     */
    function getAsk(Intent calldata intent, uint256 amount) public pure returns (uint256) {
        // We should make sure that the rounding is always for the benefit of the intent owner to prevent exploits
        // Example: when the seller offers to sell 7 ABC for 10 CHF, the accurate price would be 4.2857....
        // The naive approach to calculate the same price using integers would be 3 * 10 / 7 = 3
        // But with the given approach, we get 10 - (7 - 3) * 10 / 7 = 5, which is higher than tha accurate price.
        return intent.amountIn - intent.amountIn * (intent.amountOut - amount) / intent.amountOut;
    }

    /**
     * @notice Calculates the bidding price for a given amount of tokenIn.
     * @dev Ideally called with an intent where tokenOut is a currency with many (e.g. 18) decimals.
     * @dev TokenIn can have very few decimals.
     * @param intent The trade intent data structure.
     * @param amount The amount of tokenIn.
     * @return The calculated bidding price.
     */
    function getBid(Intent calldata intent, uint256 amount) public pure returns (uint256) {
        // We should make sure that the rounding is always for the benefit of the intent owner to prevent exploits
        // Example: when the buyer offers to buy 7 ABC for 10 CHF, but only 3 can be filled, the accurate price would be 4.2857....
        // With this calculation, we get a rounded down bid of 10 * 3 / 7 = 4
        return intent.amountOut * amount / intent.amountIn;
    }

    /**
     * @notice Determines the maximum valid amount that can be traded based on seller and buyer intents.
     * @param sellerIntent The seller's trade intent.
     * @param buyerIntent The buyer's trade intent.
     * @return The maximum valid trade amount.
     */
    function getMaxValidAmount(Intent calldata sellerIntent, Intent calldata buyerIntent) public view returns (uint256) {
        uint256 sellerAvailable = transfer.getPermittedAmount(sellerIntent.owner, toPermit(sellerIntent));
        uint256 buyerAvailable = transfer.getPermittedAmount(buyerIntent.owner, toPermit(buyerIntent));
        uint256 biddingFor = buyerIntent.amountIn * buyerAvailable / buyerIntent.amountOut;
        uint256 maxAmount = biddingFor > sellerAvailable ? sellerAvailable : biddingFor;
        uint256 ask = getAsk(sellerIntent, maxAmount);
        uint256 bid = getBid(buyerIntent, maxAmount);
        if (bid < ask) revert TradeReactor_OfferTooLow();
        return maxAmount;
    }

    /**
     * @notice Processes a trade between a seller and a buyer with the maximum valid amount.
     * @param feeRecipient The address that will receive the fee.
     * @param sellerIntent The seller's trade intent.
     * @param sellerSig The seller's signature.
     * @param buyerIntent The buyer's trade intent.
     * @param buyerSig The buyer's signature.
     */    
    function process(address feeRecipient, Intent calldata sellerIntent, bytes calldata sellerSig, Intent calldata buyerIntent, bytes calldata buyerSig) external {
        process(feeRecipient, sellerIntent, sellerSig, buyerIntent, buyerSig, getMaxValidAmount(sellerIntent, buyerIntent));
    }

    /**
     * @notice Processes a trade between a seller and a buyer for a specified amount.
     * @param feeRecipient The address that will receive the fee.
     * @param sellerIntent The seller's trade intent.
     * @param sellerSig The seller's signature.
     * @param buyerIntent The buyer's trade intent.
     * @param buyerSig The buyer's signature.
     * @param amount The amount of the token to trade.
     */
    function process(address feeRecipient, Intent calldata sellerIntent, bytes calldata sellerSig, Intent calldata buyerIntent, bytes calldata buyerSig, uint256 amount) public {
        // signatures will be verified in SignatureTransfer
        if (sellerIntent.tokenOut != buyerIntent.tokenIn || sellerIntent.tokenIn != buyerIntent.tokenOut) revert TradeReactor_TokenMismatch();
        if (sellerIntent.filler != address(0x0) && sellerIntent.filler != msg.sender) revert TradeReactor_InvalidFiller();
        if (buyerIntent.filler != address(0x0) && buyerIntent.filler != msg.sender) revert TradeReactor_InvalidFiller();
        uint256 ask = getAsk(sellerIntent, amount);
        uint256 bid = getBid(buyerIntent, amount);
        if (bid < ask) revert TradeReactor_OfferTooLow();
        // move tokens to reactor in order to implicitly allowlist target address in case reactor is powerlisted
        transfer.permitWitnessTransferFrom(toPermit(sellerIntent), toDetails(address(this), amount), sellerIntent.owner, sellerIntent.hash(), IntentHash.PERMIT2_INTENT_TYPE, sellerSig);
        transfer.permitWitnessTransferFrom(toPermit(buyerIntent), toDetails(address(this), bid), buyerIntent.owner, buyerIntent.hash(), IntentHash.PERMIT2_INTENT_TYPE, buyerSig);
        // move tokens to target addresses
        IERC20(sellerIntent.tokenOut).safeTransfer(buyerIntent.owner, amount);
        IERC20(sellerIntent.tokenIn).safeTransfer(sellerIntent.owner, ask);
        IERC20(sellerIntent.tokenIn).safeTransfer(feeRecipient, bid - ask); // collect spread as fee
        emit Trade(sellerIntent.owner, buyerIntent.owner, sellerIntent.tokenOut, amount, sellerIntent.tokenIn, ask, bid - ask);
    }

    /**
     * @notice Buys tokens from a Brokerbot.
     * @dev This function allows a user to buy tokens from a Brokerbot by transferring the specified amount of investment token to the Brokerbot and receiving the purchased tokens in return. The function ensures that the offer is not too low by comparing the invested amount to the bid price.
     * @param bot The Brokerbot from which tokens are being bought.
     * @param intent The trade intent data structure.
     * @param signature The signature of the intent owner.
     * @param amount The amount of tokens to invest in the purchase.
     * @return The amount of tokens received from the Brokerbot.
     */
    function buyFromBrokerbot(IBrokerbot bot, Intent calldata intent, bytes calldata signature, uint256 amount) external returns (uint256) {
        PaymentHub hub = PaymentHub(payable(bot.paymenthub()));
        transfer.permitWitnessTransferFrom(toPermit(intent), toDetails(address(this), amount), intent.owner, intent.hash(), IntentHash.PERMIT2_INTENT_TYPE, signature);
        IERC20(intent.tokenOut).approve(address(hub), amount);
        uint256 received = hub.payAndNotify(bot, amount, intent.data);
        if (amount > getBid(intent, received)) revert TradeReactor_OfferTooLow();
        IERC20(intent.tokenIn).safeTransfer(intent.owner, received);
        IERC20(intent.tokenOut).safeTransfer(intent.owner, IERC20(intent.tokenOut).balanceOf(address(this))); // refund over paid amount
        return received;
    }

    /**
     * @notice Sells tokens to a Brokerbot.
     * @dev This function allows a user to sell tokens to a Brokerbot by transferring the specified amount of tokens to the Brokerbot and receiving the payment in return. The function ensures that the received amount is not lower than the ask price.
     * @param bot The Brokerbot to which tokens are being sold.
     * @param intent The trade intent data structure.
     * @param signature The signature of the intent owner.
     * @param soldShares The amount of tokens being sold.
     * @return The amount of payment received from the Brokerbot.
     */
    function sellToBrokerbot(IBrokerbot bot, Intent calldata intent, bytes calldata signature, uint256 soldShares)public returns (uint256) {
        PaymentHub hub = PaymentHub(payable(bot.paymenthub()));
        transfer.permitWitnessTransferFrom(toPermit(intent), toDetails(address(this), soldShares), intent.owner, intent.hash(), IntentHash.PERMIT2_INTENT_TYPE, signature);
        IERC20(intent.tokenOut).approve(address(hub), soldShares);
        uint256 received = hub.payAndNotify(IERC20(intent.tokenOut), bot, soldShares, intent.data);
        if (received < getAsk(intent, soldShares)) revert TradeReactor_OfferTooLow();
        IERC20(intent.tokenIn).safeTransfer(intent.owner, received);
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