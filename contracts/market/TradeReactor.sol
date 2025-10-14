// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import {IERC20} from "../ERC20/IERC20.sol";
import {Intent, IntentHash} from "./IntentHash.sol";
import {SafeERC20} from "../utils/SafeERC20.sol";
import {IReactor} from "./IReactor.sol";

/**
 * @title TradeReactor Contract
 * @notice This contract handles the signaling and processing of trade intents between buyers and sellers.
*/
contract TradeReactor is IReactor {

    using IntentHash for Intent;
    using SafeERC20 for IERC20;

    mapping(bytes32 => uint160) public filledAmount;

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

    error OfferTooLow();
    error InvalidFiller();
    error TokenMismatch();
    error SpreadTooLow(uint256 bid, uint256 ask, uint16 minSpread);
    error OverFilled();
    error SignatureExpired(uint256 signatureDeadline);

    /**
     * @notice A function to publicly signal an intent to buy or sell a token so it can be picked up by the filler for processing.
     * Alternaticely, the owner can directly communicate with the filler, without recording the intent on chain.
     * @param intent The trade intent data structure. 
     * @param signature The signature of the intent owner.
    */
    function signalIntent(Intent calldata intent, bytes calldata signature) external {
        verify(intent, signature);
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

    function getTotalExecutionPrice(Intent calldata buyerIntent, Intent calldata sellerIntent, uint256 tradedTokens) public pure returns (uint256) {
        uint256 ask = getAsk(sellerIntent, tradedTokens);
        uint256 bid = getBid(buyerIntent, tradedTokens);
        if (bid < ask) revert OfferTooLow();

        uint256 executionPrice = (sellerIntent.creation >= buyerIntent.creation) ? ask : bid;
        uint256 totalCost = executionPrice * tradedTokens;
        return totalCost;
    }

    function getFilledAmount(Intent calldata intent) external view returns (uint160) {
        return filledAmount[intent.hash()];
    }

    /**
     * @notice Determines the maximum valid amount that can be traded based on seller and buyer intents.
     * @param sellerIntent The seller's trade intent.
     * @param buyerIntent The buyer's trade intent.
     * @return The maximum valid trade amount.
     */
    function getMaxValidAmount(Intent calldata sellerIntent, Intent calldata buyerIntent, uint16 minSpread) public view returns (uint256) {
        uint256 sellerUnfilled = sellerIntent.amountOut - filledAmount[sellerIntent.hash()];
        uint256 buyerUnfilled = buyerIntent.amountIn - filledAmount[buyerIntent.hash()];
        uint256 biddingFor = buyerIntent.amountIn * buyerAvailable / buyerIntent.amountOut;
        uint256 maxAmount = biddingFor > sellerAvailable ? sellerAvailable : biddingFor;
        uint256 ask = getAsk(sellerIntent, maxAmount);
        uint256 bid = getBid(buyerIntent, maxAmount);
        if ((bid < ask) || (bid - ask < (ask * minSpread) / 10000)) revert SpreadTooLow(bid, ask, minSpread);
        return maxAmount;
    }

    /**
     * @notice Processes a trade between a seller and a buyer with the maximum valid amount.
     * @param sellerIntent The seller's trade intent.
     * @param sellerSig The seller's signature.
     * @param buyerIntent The buyer's trade intent.
     * @param buyerSig The buyer's signature.
     */    
    function process(Intent calldata sellerIntent, bytes calldata sellerSig, Intent calldata buyerIntent, bytes calldata buyerSig) external {
        process(sellerIntent, sellerSig, buyerIntent, buyerSig, getMaxValidAmount(sellerIntent, buyerIntent, 0));
    }

    /**
     * @notice Processes a trade between a seller and a buyer for a specified amount.
     * @param sellerIntent The seller's trade intent.
     * @param sellerSig The seller's signature.
     * @param buyerIntent The buyer's trade intent.
     * @param buyerSig The buyer's signature.
     * @param tradedTokens The amount of the token to trade.
     */
    function process(Intent calldata sellerIntent, bytes calldata sellerSig, Intent calldata buyerIntent, bytes calldata buyerSig, uint256 tradedTokens, uint256 totalFee) public {
        verify(sellerIntent, sellerSig);
        verify(buyerIntent, buyerSig);
        if (sellerIntent.tokenOut != buyerIntent.tokenIn) revert TokenMismatch();
        if (sellerIntent.tokenIn != buyerIntent.tokenOut) revert TokenMismatch();
        if (tradedTokens > (sellerIntent.amountOut - filledAmount[sellerIntent.hash()])) revert OverFilled();
        if (tradedTokens > (buyerIntent.amountIn - filledAmount[buyerIntent.hash()])) revert OverFilled();

        filledAmount[sellerIntent.hash()] += uint160(tradedTokens);
        filledAmount[buyerIntent.hash()] += uint160(tradedTokens);

        uint256 totalExecutionPrice = getTotalExecutionPrice(buyerIntent, sellerIntent, tradedTokens);

        // Move tokens to reactor in order to implicitly allowlist the buyer in case TradeReactor is powerlisted
        IERC20(sellerIntent.tokenOut).safeTransferFrom(sellerIntent.owner, address(this), tradedTokens);
        IERC20(buyerIntent.tokenOut).safeTransferFrom(buyerIntent.owner, address(this), totalExecutionPrice);

        // Distribute proceeds
        IERC20(sellerIntent.tokenOut).safeTransfer(buyerIntent.owner, tradedTokens); // transfer sold tokens to buyer
        IERC20(sellerIntent.tokenIn).safeTransfer(sellerIntent.owner, totalExecutionPrice - totalFee); // transfer net proceeds to seller
        IERC20(sellerIntent.tokenIn).safeTransfer(msg.sender, totalFee); // collect fee to msg.sender

        //leave it to the filler to emit an event with the fees correctly specified
        //emit Trade(sellerIntent.owner, buyerIntent.owner, sellerIntent.tokenOut, amount, sellerIntent.tokenIn, ask, bid - ask);
    }

    function verify(Intent calldata intent, bytes calldata signature) public view {
        intent.verifyIntentSignature(signature);
        if (block.timestamp > intent.expiration) revert SignatureExpired(intent.expiration);
        if (intent.filler != msg.sender || intent.filler != address(0x0)) revert InvalidFiller();
    }

    function cleanupExpiredIntentData(Intent[] calldata intents) external {
        for (uint i = 0; i < intents.length; i++) {
            Intent calldata intent = intents[i];
            if (block.timestamp > intent.expiration) {
                delete filledAmount[intent.hash()];
            }
        }
    }
}