// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {IERC20} from "../ERC20/IERC20.sol";
import {Ownable} from "../utils/Ownable.sol";
import {SafeERC20} from "../utils/SafeERC20.sol";
import {IntentVerifier} from "./IntentVerifier.sol";
import {Intent, IntentHash} from "./IntentHash.sol";

/**
 * @title SecondaryMarket
 *
 * @author Luzius Meisser, luzius@aktionariat.com
 * @author Murat Ögat, murat@aktionariat.com
 *
 * @notice The peer-to-peer market for one token against one currency, controlled by the issuer.
 * @notice Holders sign trade intents off-chain (EIP-712, domain bound to this market), a filler matches a
 * buy against a sell and calls `process`, and the market verifies both signatures, checks the price, settles
 * the trade and keeps the trading fee. Nothing is locked up: the only on-chain commitment is an ERC-20
 * allowance to this market.
 * @notice An intent is valid only for the market it was signed for and only for the side its tokens imply:
 * an intent giving TOKEN is a sell, an intent giving CURRENCY is a buy. Consequently it has one fill counter
 * in one unit (tokens) and can never be filled beyond the signed maximum.
 * @notice If an intent names a `filler`, only that address may submit it to `process`; with the zero address
 * anyone may. Whoever submits decides nothing but the pairing and the amount; the price follows from the
 * two intents and the fee from `tradingFeeBips`, which the issuer commits to keep at or below 5%.
 * @notice If a `router` is configured, only that address can call `process`, which prevents front-running
 * of the matching; if not, anyone can act as filler.
 */

contract SecondaryMarket is Ownable, IntentVerifier {
    using IntentHash for Intent;
    using SafeERC20 for IERC20;

    // Version
    // 1: initial version
    // 2: process only accepts intents for this market's token and currency
    // 3: TradeReactor merged into the market: intents are signed for the market, the fee is computed here,
    //    intents cannot be created in the future
    uint16 public constant VERSION = 3;

    uint16 public constant ALL = 10000;
    uint16 public constant MAX_TRADING_FEE_BIPS = 500; // the issuer commits to never set the fee above 5%
    address public constant LICENSE_FEE_RECIPIENT = 0x29Fe8914e76da5cE2d90De98a64d0055f199d06D;
    uint256 public constant CANCELLED = type(uint256).max;

    address public immutable CURRENCY;
    address public immutable TOKEN;

    /// @notice Filled amount per intent hash, always in tokens; `CANCELLED` once cancelled.
    mapping(bytes32 => uint256) public filledAmount;

    address public router; // null for any, 20B
    uint16 public tradingFeeBips; // 2B
    uint16 public licenseShare; // Share of the trading fee that goes to the license fee recipient in bips
    bool public isOpen;

    /// @dev Emitted by `placeOrder` so a filler can pick the intent up. Fields mirror the Intent struct.
    event IntentSignal(address owner, address filler, address tokenOut, uint256 amountOut, address tokenIn, uint256 amountIn, uint256 creation, uint256 expiration, bytes data, bytes signature);
    event TradingFeeWithdrawn(address currency, address target, uint256 amount);
    event LicenseFeePaid(address currency, address target, uint256 amount);
    event MarketStatusChanged(bool isOpen, uint256 timestamp);
    event Trade(address indexed seller, address indexed buyer, bytes32 sellIntentHash, bytes32 buyIntentHash, address token, uint256 tokenAmount, address currency, uint256 currencyAmount, uint256 fees);

    error WrongTokens();
    error WrongRouter(address expected, address actual);
    error InvalidFiller();
    error IntentExpired(uint256 expiration);
    error IntentFromTheFuture(uint256 creation);
    error OfferTooLow();
    error OverFilled();
    error NothingToTrade();
    error NotAuthorized();
    error InvalidConfiguration();
    error MarketClosed();
    error AlreadyFilled();
    error UserCancelled();

    constructor(address owner, address currency, address token, address _router) Ownable(owner) {
        CURRENCY = currency;
        TOKEN = token;
        tradingFeeBips = 190; // default trading fee is 1.9%
        licenseShare = 5000; // default license share is 50% of trading fee
        router = _router;
        isOpen = true;
    }

    //// ADMINISTRATION ////

    /**
     * Opens the market.
     */
    function open() onlyOwner external {
        isOpen = true;
        emit MarketStatusChanged(true, block.timestamp);
    }

    /**
     * Closes the market.
     */
    function close() onlyOwner external {
        isOpen = false;
        emit MarketStatusChanged(false, block.timestamp);
    }

    /**
     * Configures the permissible router or the null address for any.
     *
     * Having a trusted router helps with the prevention of front-running attacks as no
     * one else can front the router with a different matching of the submitted orders.
     */
    function setRouter(address router_) onlyOwner external {
        router = router_;
    }

    /**
     * Configures the software license fee as agreed with the copyright owners.
     */
    function setLicenseFee(uint16 licenseShare_) onlyOwner external {
        if (uint256(licenseShare_) > ALL) revert InvalidConfiguration();
        licenseShare = licenseShare_;
    }

    /**
     * Sets the trading fee charged to the seller on every trade, at most `MAX_TRADING_FEE_BIPS`.
     * The fee is not part of the signed intent; a seller prices it into the ask knowing this ceiling.
     */
    function setTradingFee(uint16 tradingFeeBips_) onlyOwner external {
        if (tradingFeeBips_ > MAX_TRADING_FEE_BIPS) revert InvalidConfiguration();
        tradingFeeBips = tradingFeeBips_;
    }

    //// ORDERS ////

    /**
     * Create a buy order intent that can be signed by the owner.
     * The filler is left open; the configured router, if any, is enforced in `process` regardless.
     */
    function createBuyOrder(address owner, uint256 amountOut, uint256 amountIn, uint24 validitySeconds) public view returns (Intent memory) {
        return Intent(owner, address(0), CURRENCY, amountOut, TOKEN, amountIn, block.timestamp, block.timestamp + validitySeconds, new bytes(0));
    }

    /**
     * Create a sell order intent that can be signed by the owner.
     * The amountIn is what the seller receives before the trading fee, which is always charged to the seller.
     */
    function createSellOrder(address owner, uint256 amountOut, uint256 amountIn, uint24 validitySeconds) public view returns (Intent memory) {
        return Intent(owner, address(0), TOKEN, amountOut, CURRENCY, amountIn, block.timestamp, block.timestamp + validitySeconds, new bytes(0));
    }

    function getIntentHash(Intent calldata intent) external pure returns (bytes32) {
        return intent.hash();
    }

    function getFilledAmount(Intent calldata intent) external view returns (uint256) {
        return filledAmount[intent.hash()];
    }

    /**
     * Stores an order in the Ethereum blockchain as a publicly readable event, so any allowed router
     * can pick it up and execute it against another valid order.
     *
     * In case the owner configured a specific router to be used, it is usually better to send the
     * order to the configured router directly through a suitable API. Note that all partially filled
     * orders and all filled orders are publicly recorded on-chain anyway, so taking the direct
     * transmission shortcut does not effectively preserve privacy.
     */
    function placeOrder(Intent calldata intent, bytes calldata signature) external {
        validateOrder(intent, signature);
        emit IntentSignal(intent.owner, intent.filler, intent.tokenOut, intent.amountOut, intent.tokenIn, intent.amountIn, intent.creation, intent.expiration, intent.data, signature);
    }

    /**
     * Verifies that the intent is signed by its owner for this market, is not expired and was not created
     * in the future. Who may submit it (`filler`) is checked in `process`.
     */
    function verify(Intent calldata intent, bytes calldata signature) public view {
        _verify(intent, intent.hash(), signature);
    }

    /// @dev `intentHash` must be `intent.hash()`; callers pass it in so it is computed only once.
    function _verify(Intent calldata intent, bytes32 intentHash, bytes calldata signature) internal view {
        _verifyIntentSignature(intent, intentHash, signature);
        if (block.timestamp > intent.expiration) revert IntentExpired(intent.expiration);
        // The later intent takes the spread, so the creation time must not be chosen freely.
        // Equality is allowed: the view that builds the intent and the settlement may share a block.
        if (intent.creation > block.timestamp) revert IntentFromTheFuture(intent.creation);
    }

    /**
     * Marks an intent as fully filled. Allowed for the intent owner, the named filler, the router and the
     * market owner.
     */
    function cancelIntent(Intent calldata intent) external {
        if (msg.sender != intent.owner && msg.sender != intent.filler && msg.sender != router && msg.sender != owner) revert NotAuthorized();
        filledAmount[intent.hash()] = CANCELLED;
    }

    /**
     * Frees the storage of expired intents.
     */
    function cleanupExpiredIntentData(Intent[] calldata intents) external {
        for (uint i = 0; i < intents.length; i++) {
            Intent calldata intent = intents[i];
            if (block.timestamp > intent.expiration) {
                delete filledAmount[intent.hash()];
            }
        }
    }

    //// PRICING ////

    /**
     * @notice Calculates the asking price for a given amount of tokenOut of a sell intent.
     * @dev tokenIn is the currency with many (e.g. 18) decimals, tokenOut can have very few decimals.
     */
    function getAsk(Intent calldata intent, uint256 amount) public pure returns (uint256) {
        // We should make sure that the rounding is always for the benefit of the intent owner to prevent exploits
        // Example: when the seller offers to sell 7 ABC for 10 CHF, the accurate price would be 4.2857....
        // The naive approach to calculate the same price using integers would be 3 * 10 / 7 = 3
        // But with the given approach, we get 10 - (7 - 3) * 10 / 7 = 5, which is higher than tha accurate price.
        return intent.amountIn - intent.amountIn * (intent.amountOut - amount) / intent.amountOut;
    }

    /**
     * @notice Calculates the bidding price for a given amount of tokenIn of a buy intent.
     * @dev tokenOut is the currency with many (e.g. 18) decimals, tokenIn can have very few decimals.
     */
    function getBid(Intent calldata intent, uint256 amount) public pure returns (uint256) {
        // We should make sure that the rounding is always for the benefit of the intent owner to prevent exploits
        // Example: when the buyer offers to buy 7 ABC for 10 CHF, but only 3 can be filled, the accurate price would be 4.2857....
        // With this calculation, we get a rounded down bid of 10 * 3 / 7 = 4
        return intent.amountOut * amount / intent.amountIn;
    }

    function verifyPriceMatch(Intent calldata buyerIntent, Intent calldata sellerIntent) public pure {
        uint256 ask = getAsk(sellerIntent, 1);
        uint256 bid = getBid(buyerIntent, 1);
        if (bid < ask) revert OfferTooLow();
    }

    /**
     * The trade executes at the earlier intent's price: whoever posted first gets their exact price.
     */
    function getTotalExecutionPrice(Intent calldata buyerIntent, Intent calldata sellerIntent, uint256 tradedAmount) public pure returns (uint256) {
        verifyPriceMatch(buyerIntent, sellerIntent);
        return (sellerIntent.creation >= buyerIntent.creation) ? getBid(buyerIntent, tradedAmount) : getAsk(sellerIntent, tradedAmount);
    }

    //// ORDER BOOK ////

    /**
     * Check if an order can be executed and if yes, returns the maximum amount of the tokenOut.
     */
    function validateOrder(Intent calldata intent, bytes calldata sig) public view returns (uint256 unfilled, uint256 balance, uint256 allowance) {
        verify(intent, sig);
        require((intent.tokenOut == TOKEN && intent.tokenIn == CURRENCY) || (intent.tokenOut == CURRENCY && intent.tokenIn == TOKEN), WrongTokens());

        balance = IERC20(intent.tokenOut).balanceOf(intent.owner);
        allowance = IERC20(intent.tokenOut).allowance(intent.owner, address(this));

        uint256 amountTokens = (intent.tokenOut == TOKEN) ? intent.amountOut : intent.amountIn;
        uint256 alreadyFilled = filledAmount[intent.hash()];
        if (alreadyFilled == CANCELLED) revert UserCancelled();
        if (amountTokens <= alreadyFilled) revert AlreadyFilled();
        uint256 remaining = amountTokens - alreadyFilled;

        return (remaining, balance, allowance);
    }

    /**
     * Returns multiple order book entries for an array of intents, avoiding multiple calls.
     * The returned numbers are to be used directly in the order book.
     * Therefore, this function doesn't revert, it returns 0 for unexecutable entries instead,
     * including intents for another pair and degenerate intents that could never match.
     */
    function executableAmounts(Intent[] calldata intents) public view returns (uint256[] memory) {
        uint256[] memory available = new uint256[](intents.length);
        for (uint256 i = 0; i < intents.length; i++) {
            available[i] = executableAmount(intents[i]);
        }
        return available;
    }

    /**
     * Check if an order can be executed and if yes, returns the maximum amount in TOKENS that can be executed immediately.
     * Considers the unfilled amount, and also the actual balance and allowance of the intent owner.
     * This is useful for user interfaces to show how much can be traded right now. Never reverts.
     */
    function executableAmount(Intent calldata intent) public view returns (uint256) {
        if (intent.tokenOut == TOKEN && intent.tokenIn == CURRENCY) {
            return executableSellAmount(intent);
        } else if (intent.tokenOut == CURRENCY && intent.tokenIn == TOKEN) {
            return executableBuyAmount(intent);
        } else {
            return 0;
        }
    }

    /**
     * Internal counterpart of executableAmount for selling.
     * This is straightforward as we can directly check the token balance and allowance.
     */
    function executableSellAmount(Intent calldata intent) internal view returns (uint256) {
        uint256 alreadyFilled = filledAmount[intent.hash()];
        uint256 balance = IERC20(intent.tokenOut).balanceOf(intent.owner);
        uint256 allowance = IERC20(intent.tokenOut).allowance(intent.owner, address(this));

        if (intent.amountOut <= alreadyFilled) return 0;

        uint256 unfilled = intent.amountOut - alreadyFilled;
        uint256 availableInWallet = (balance < allowance) ? balance : allowance;
        uint256 finalAvailable = (unfilled < availableInWallet) ? unfilled : availableInWallet;

        return finalAvailable;
    }

    /**
     * Internal counterpart of executableAmount for buying.
     * This is slightly more tricky, as we need to check balance/allowance in CURRENCY
     * but return available amount in TOKENS, so getBid() is used to get the conversion rate.
     */
    function executableBuyAmount(Intent calldata intent) internal view returns (uint256) {
        if (intent.amountIn == 0) return 0; // nothing to buy
        uint256 bid = getBid(intent, 1);
        if (bid == 0) return 0; // less than one currency unit per token cannot match any ask
        uint256 alreadyFilled = filledAmount[intent.hash()];
        uint256 balanceInShares = IERC20(intent.tokenOut).balanceOf(intent.owner) / bid;
        uint256 allowanceInShares = IERC20(intent.tokenOut).allowance(intent.owner, address(this)) / bid;

        if (intent.amountIn <= alreadyFilled) return 0;

        uint256 unfilled = intent.amountIn - alreadyFilled;
        uint256 availableInShares = (balanceInShares < allowanceInShares) ? balanceInShares : allowanceInShares;
        uint256 finalAvailable = (unfilled < availableInShares) ? unfilled : availableInShares;

        return finalAvailable;
    }

    /**
     * Convenience method to check with 2 intents to get what can be executed right now.
     * Takes into account unfilled amounts, balances and allowances of both sides.
     * Also reverts if price is not matching, with OfferTooLow().
     */
    function executableTrade(Intent calldata sellerIntent, Intent calldata buyerIntent) external view returns (uint256) {
        if (sellerIntent.amountOut == 0 || buyerIntent.amountIn == 0) return 0; // degenerate, would divide by zero
        verifyPriceMatch(buyerIntent, sellerIntent);
        uint256 executableSell = executableSellAmount(sellerIntent);
        uint256 executableBuy = executableBuyAmount(buyerIntent);
        return (executableSell < executableBuy) ? executableSell : executableBuy;
    }

    //// SETTLEMENT ////

    /**
     * @notice Settles `tradedAmount` tokens between a sell intent and a buy intent of this market.
     * The seller's intent must give TOKEN for CURRENCY and the buyer's the reverse, so each intent fits
     * exactly one slot. The buyer pays the execution price, the seller receives it minus the trading fee,
     * which stays in this contract until `withdrawFees`.
     */
    function process(Intent calldata seller, bytes calldata sellerSig, Intent calldata buyer, bytes calldata buyerSig, uint256 tradedAmount) external {
        if (!isOpen) revert MarketClosed();
        if (router != address(0) && msg.sender != router) revert WrongRouter(router, msg.sender);
        if (seller.tokenOut != TOKEN || seller.tokenIn != CURRENCY) revert WrongTokens();
        if (buyer.tokenOut != CURRENCY || buyer.tokenIn != TOKEN) revert WrongTokens();
        if (tradedAmount == 0) revert NothingToTrade(); // would emit a Trade at price zero

        bytes32 sellerHash = seller.hash();
        bytes32 buyerHash = buyer.hash();
        _verify(seller, sellerHash, sellerSig);
        _verify(buyer, buyerHash, buyerSig);
        if (seller.filler != msg.sender && seller.filler != address(0)) revert InvalidFiller();
        if (buyer.filler != msg.sender && buyer.filler != address(0)) revert InvalidFiller();
        _fill(sellerHash, seller.amountOut, tradedAmount);
        _fill(buyerHash, buyer.amountIn, tradedAmount);

        uint256 totalExecutionPrice = getTotalExecutionPrice(buyer, seller, tradedAmount);
        uint256 totalFee = totalExecutionPrice * tradingFeeBips / ALL;

        // Route both legs through the market so the buyer gets allowlisted on the way if the market is typed admin
        IERC20(TOKEN).safeTransferFrom(seller.owner, address(this), tradedAmount);
        IERC20(CURRENCY).safeTransferFrom(buyer.owner, address(this), totalExecutionPrice);
        IERC20(TOKEN).safeTransfer(buyer.owner, tradedAmount);
        IERC20(CURRENCY).safeTransfer(seller.owner, totalExecutionPrice - totalFee);

        emit Trade(seller.owner, buyer.owner, sellerHash, buyerHash, TOKEN, tradedAmount, CURRENCY, totalExecutionPrice, totalFee);
    }

    /// @dev Adds `amount` to the fill counter of an intent capped at `max`; a cancelled intent counts as full.
    function _fill(bytes32 intentHash, uint256 max, uint256 amount) private {
        uint256 filled = filledAmount[intentHash];
        if (amount > max || filled > max - amount) revert OverFilled();
        filledAmount[intentHash] = filled + amount;
    }

    //// FEES ////

    /**
     * Withdraw the accumulated fees applying the license share split between the two addresses.
     *
     * The assumption is that this can be used to collect accumulated trading fees and to pay license fees
     * to Aktionariat in the same transaction for convenience.
     */
    function withdrawFees() external {
        withdrawFees(CURRENCY, IERC20(CURRENCY).balanceOf(address(this)));
    }

    function withdrawFees(address currency, uint256 amount) public onlyOwner {
        uint256 split = amount * licenseShare / ALL;
        IERC20(currency).safeTransfer(owner, amount - split); // rounded up
        IERC20(currency).safeTransfer(LICENSE_FEE_RECIPIENT, split); // rounded down
        emit TradingFeeWithdrawn(currency, owner, amount - split);
        emit LicenseFeePaid(currency, LICENSE_FEE_RECIPIENT, split);
    }

}
