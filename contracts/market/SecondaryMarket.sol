// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

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
 * @notice Peer-to-peer market for one token against one currency, controlled by the issuer.
 * @notice Holders sign intents off-chain (EIP-712, bound to this market), the router matches and calls process.
 * @notice Intents giving TOKEN are sells, intents giving CURRENCY are buys. Filled amounts are counted in tokens.
 * @notice If a router is set, only it can call process. See doc/secondarymarket.md.
 */

contract SecondaryMarket is Ownable, IntentVerifier {
    using IntentHash for Intent;
    using SafeERC20 for IERC20;

    // Version
    // 1: initial version
    // 2: process only accepts intents for this market's token and currency
    // 3: TradeReactor merged into the market
    uint16 public constant VERSION = 3;

    uint16 public constant ALL = 10000;
    uint16 public constant MAX_TRADING_FEE_BIPS = 500;
    address public constant LICENSE_FEE_RECIPIENT = 0x29Fe8914e76da5cE2d90De98a64d0055f199d06D;
    uint256 public constant CANCELLED = type(uint256).max;

    address public immutable CURRENCY;
    address public immutable TOKEN;

    mapping(bytes32 => uint256) public filledAmount; // in tokens, CANCELLED once cancelled

    address public router; // null for any, 20B
    uint16 public tradingFeeBips; // 2B
    uint16 public licenseShare; // Share of the trading fee that goes to the license fee recipient in bips
    bool public isOpen;

    event IntentSignal(address owner, address router, address tokenOut, uint256 amountOut, address tokenIn, uint256 amountIn, uint256 creation, uint256 expiration, bytes data, bytes signature);
    event TradingFeeWithdrawn(address currency, address target, uint256 amount);
    event LicenseFeePaid(address currency, address target, uint256 amount);
    event MarketStatusChanged(bool isOpen, uint256 timestamp);
    event Trade(address indexed seller, address indexed buyer, bytes32 sellIntentHash, bytes32 buyIntentHash, address token, uint256 tokenAmount, address currency, uint256 currencyAmount, uint256 fees);

    error WrongTokens();
    error WrongRouter(address expected, address actual);
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

    function open() onlyOwner external {
        isOpen = true;
        emit MarketStatusChanged(true, block.timestamp);
    }

    function close() onlyOwner external {
        isOpen = false;
        emit MarketStatusChanged(false, block.timestamp);
    }

    /**
     * Configures the permissible router or the null address for any.
     * A trusted router prevents front-running with a different matching of the same orders.
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

    function setTradingFee(uint16 tradingFeeBips_) onlyOwner external {
        if (tradingFeeBips_ > MAX_TRADING_FEE_BIPS) revert InvalidConfiguration();
        tradingFeeBips = tradingFeeBips_;
    }

    //// ORDERS ////

    /**
     * Create an order intent that can be signed by the owner.
     */
    function createBuyOrder(address owner, uint256 amountOut, uint256 amountIn, uint24 validitySeconds) public view returns (Intent memory) {
        return Intent(owner, router, CURRENCY, amountOut, TOKEN, amountIn, block.timestamp, block.timestamp + validitySeconds, new bytes(0));
    }

    /**
     * Create an order intent that can be signed by the owner.
     * The trading fee is deducted from amountIn, it is always charged to the seller.
     */
    function createSellOrder(address owner, uint256 amountOut, uint256 amountIn, uint24 validitySeconds) public view returns (Intent memory) {
        return Intent(owner, router, TOKEN, amountOut, CURRENCY, amountIn, block.timestamp, block.timestamp + validitySeconds, new bytes(0));
    }

    function getIntentHash(Intent calldata intent) external pure returns (bytes32) {
        return intent.hash();
    }

    function getFilledAmount(Intent calldata intent) external view returns (uint256) {
        return filledAmount[intent.hash()];
    }

    /**
     * Publishes a valid order as an event so the router can pick it up.
     * Sending it to the router directly is equivalent, fills are recorded on-chain anyway.
     */
    function placeOrder(Intent calldata intent, bytes calldata signature) external {
        validateOrder(intent, signature);
        emit IntentSignal(intent.owner, intent.router, intent.tokenOut, intent.amountOut, intent.tokenIn, intent.amountIn, intent.creation, intent.expiration, intent.data, signature);
    }

    /**
     * Signature, expiration and creation. The router is checked in process.
     */
    function verify(Intent calldata intent, bytes calldata signature) public view {
        _verify(intent, intent.hash(), signature);
    }

    function _verify(Intent calldata intent, bytes32 intentHash, bytes calldata signature) internal view {
        _verifyIntentSignature(intent, intentHash, signature);
        if (block.timestamp > intent.expiration) revert IntentExpired(intent.expiration);
        if (intent.creation > block.timestamp) revert IntentFromTheFuture(intent.creation); // the later intent takes the spread
    }

    /**
     * Marks an intent as fully filled.
     */
    function cancelIntent(Intent calldata intent) external {
        if (msg.sender != intent.owner && msg.sender != intent.router && msg.sender != router && msg.sender != owner) revert NotAuthorized();
        filledAmount[intent.hash()] = CANCELLED;
    }

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
     * Asking price of a sell intent for the given amount of tokenOut, rounded up.
     * Example: selling 7 ABC for 10 CHF, 3 ABC cost ceil(30 / 7) = 5.
     */
    function getAsk(Intent calldata intent, uint256 amount) public pure returns (uint256) {
        return (intent.amountIn * amount + intent.amountOut - 1) / intent.amountOut;
    }

    /**
     * Bidding price of a buy intent for the given amount of tokenIn, rounded down.
     * Example: buying 7 ABC for 10 CHF, 3 ABC are worth 10 * 3 / 7 = 4.
     */
    function getBid(Intent calldata intent, uint256 amount) public pure returns (uint256) {
        return intent.amountOut * amount / intent.amountIn;
    }

    /**
     * Exact comparison of bid and ask without rounding: buyerOut / buyerIn >= sellerIn / sellerOut.
     */
    function verifyPriceMatch(Intent calldata sellerIntent, Intent calldata buyerIntent) public pure {
        if (buyerIntent.amountOut * sellerIntent.amountOut < sellerIntent.amountIn * buyerIntent.amountIn) revert OfferTooLow();
    }

    /**
     * The earlier intent gets its exact price, rounded in its favour. The later one can be one unit worse.
     */
    function getTotalExecutionPrice(Intent calldata sellerIntent, Intent calldata buyerIntent, uint256 tradedAmount) public pure returns (uint256) {
        verifyPriceMatch(sellerIntent, buyerIntent);
        return (sellerIntent.creation >= buyerIntent.creation) ? getBid(buyerIntent, tradedAmount) : getAsk(sellerIntent, tradedAmount);
    }

    //// ORDER BOOK ////

    /**
     * Reverts if the order cannot be executed, else returns the unfilled amount of tokenOut.
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
     * Executable amounts for the order book. Never reverts, 0 for unexecutable entries.
     */
    function executableAmounts(Intent[] calldata intents) public view returns (uint256[] memory) {
        uint256[] memory available = new uint256[](intents.length);
        for (uint256 i = 0; i < intents.length; i++) {
            available[i] = executableAmount(intents[i]);
        }
        return available;
    }

    /**
     * Amount in TOKENS executable right now, considering unfilled amount, balance and allowance.
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
     * Balance and allowance are in CURRENCY, converted to TOKENS with getBid.
     */
    function executableBuyAmount(Intent calldata intent) internal view returns (uint256) {
        if (intent.amountIn == 0) return 0;
        uint256 bid = getBid(intent, 1);
        if (bid == 0) return 0;
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
     * Amount executable right now between two intents. Reverts with OfferTooLow if prices do not match.
     */
    function executableTrade(Intent calldata sellerIntent, Intent calldata buyerIntent) external view returns (uint256) {
        if (sellerIntent.amountOut == 0 || buyerIntent.amountIn == 0) return 0;
        verifyPriceMatch(sellerIntent, buyerIntent);
        uint256 executableSell = executableSellAmount(sellerIntent);
        uint256 executableBuy = executableBuyAmount(buyerIntent);
        return (executableSell < executableBuy) ? executableSell : executableBuy;
    }

    //// SETTLEMENT ////

    /**
     * Settles tradedAmount tokens. The buyer pays the execution price, the seller receives it minus the fee.
     */
    function process(Intent calldata seller, bytes calldata sellerSig, Intent calldata buyer, bytes calldata buyerSig, uint256 tradedAmount) external {
        if (!isOpen) revert MarketClosed();
        if (router != address(0) && msg.sender != router) revert WrongRouter(router, msg.sender);
        if (seller.tokenOut != TOKEN || seller.tokenIn != CURRENCY) revert WrongTokens();
        if (buyer.tokenOut != CURRENCY || buyer.tokenIn != TOKEN) revert WrongTokens();
        if (tradedAmount == 0) revert NothingToTrade();

        bytes32 sellerHash = seller.hash();
        bytes32 buyerHash = buyer.hash();
        _verify(seller, sellerHash, sellerSig);
        _verify(buyer, buyerHash, buyerSig);
        if (seller.router != msg.sender && seller.router != address(0)) revert WrongRouter(seller.router, msg.sender);
        if (buyer.router != msg.sender && buyer.router != address(0)) revert WrongRouter(buyer.router, msg.sender);
        _fill(sellerHash, seller.amountOut, tradedAmount);
        _fill(buyerHash, buyer.amountIn, tradedAmount);

        uint256 totalExecutionPrice = getTotalExecutionPrice(seller, buyer, tradedAmount);
        uint256 totalFee = totalExecutionPrice * tradingFeeBips / ALL;

        // Via the market, so an admin market allowlists the buyer
        IERC20(TOKEN).safeTransferFrom(seller.owner, address(this), tradedAmount);
        IERC20(CURRENCY).safeTransferFrom(buyer.owner, address(this), totalExecutionPrice);
        IERC20(TOKEN).safeTransfer(buyer.owner, tradedAmount);
        IERC20(CURRENCY).safeTransfer(seller.owner, totalExecutionPrice - totalFee);

        emit Trade(seller.owner, buyer.owner, sellerHash, buyerHash, TOKEN, tradedAmount, CURRENCY, totalExecutionPrice, totalFee);
    }

    function _fill(bytes32 intentHash, uint256 max, uint256 amount) private {
        uint256 filled = filledAmount[intentHash];
        if (amount > max || filled > max - amount) revert OverFilled(); // also when cancelled
        filledAmount[intentHash] = filled + amount;
    }

    //// FEES ////

    /**
     * Withdraws the accumulated fees, paying the license share to Aktionariat in the same transaction.
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
