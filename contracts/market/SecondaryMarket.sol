// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "../ERC20/IERC20.sol";
import "../utils/Ownable.sol";
import {IReactor} from "./IReactor.sol";
import {Intent, IntentHash} from "./IntentHash.sol";

/**
 * @title SecondaryMarket
 * 
 * @author Luzius Meisser, luzius@aktionariat.com
 * @author Murat Ögat, murat@aktionariat.com
 * 
 * @notice This contract handles the secondary market transactions and is controlled by the issuer.
 * @notice It works together with a TradeReactor contract to verify and process trade intents.
 * @notice If a filler is specified when creating and signing an intent, only this contract can forward it to the reactor for processing.
 * @notice If a router is specified in this contract, only that address can call the process function to execute trades.
 * @notice This contract also collects and distributes trading fees, if any. 
*/

contract SecondaryMarket is Ownable {
    using IntentHash for Intent;

    // Version
    // 1: initial version
    uint16 public constant VERSION = 1;

    uint16 public constant ALL = 10000;
    address public constant LICENSE_FEE_RECIPIENT = 0x29Fe8914e76da5cE2d90De98a64d0055f199d06D;
    uint256 public constant CANCELLED = type(uint256).max;

    address public immutable CURRENCY;
    address public immutable TOKEN;
    address public immutable REACTOR; 

    event TradingFeeCollected(address currency, uint256 actualFee, address spreadRecipient, uint256 returnedSpread);
    event TradingFeeWithdrawn(address currency, address target, uint256 amount);
    event LicenseFeePaid(address currency, address target, uint256 amount);
    event MarketStatusChanged(bool isOpen, uint256 timestamp);
    event Trade(address indexed seller, address indexed buyer, bytes32 sellIntentHash, bytes32 buyIntentHash, address token, uint256 tokenAmount, address currency, uint256 currencyAmount, uint256 fees);

    error LargerSpreadNeeded(uint256 feesCollected, uint256 requiredMinimum);
    error WrongFiller();
    error WrongTokens();
    error WrongRouter(address expected, address actual);
    error InvalidConfiguration();
    error MarketClosed();
    error AlreadyFilled();
    error UserCancelled();


    address public router; // null for any, 20B
    uint16 public tradingFeeBips; // 2B
    uint16 public routerShare; // Share of the trading fee that goes to the router in bips
    uint16 public licenseShare; // Share of the trading fee that goes to the router in bips
    bool public isOpen;

    constructor(address owner, address currency, address token, address _reactor, address _router) Ownable(owner) {
        CURRENCY = currency;
        TOKEN = token;
        REACTOR = _reactor;
        licenseShare = 5000; // default license fee is 50% of fees
        router = _router;
        routerShare = 0;
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
    function setRouter(address router_, uint16 routerShare_) onlyOwner external {
        if (uint256(routerShare_) + licenseShare > ALL) revert InvalidConfiguration();
        router = router_;
        routerShare = routerShare_;
    }

    /**
     * Configures the software license fee as agreed with the copyright owners.
     */
    function setLicenseFee(uint16 licenseShare_) onlyOwner external {
        if (uint256(licenseShare_) + routerShare > ALL) revert InvalidConfiguration();
        licenseShare = licenseShare_;

    }

    function setTradingFee(uint16 tradingFeeBips_) onlyOwner external {
        if (tradingFeeBips_ > 500) revert InvalidConfiguration(); // commit to never set it above 5%
        tradingFeeBips = tradingFeeBips_;
    }

    //// TRADING ////

    /**
     * Create an order intent that can be signed by the owner.
     */
    function createBuyOrder(address owner, uint256 amountOut, uint256 amountIn, uint24 validitySeconds) public view returns (Intent memory) {
        return Intent(owner, address(this), CURRENCY, amountOut, TOKEN, amountIn, block.timestamp, block.timestamp + validitySeconds, new bytes(0));
    }

    /**
     * Create an order intent that can be signed by the owner.
     * The tokenIn amount is reduced by the trading fee, which is always charged to the seller.
     */
    function createSellOrder(address owner, uint256 amountOut, uint256 amountIn, uint24 validitySeconds) public view returns (Intent memory) {
        return Intent(owner, address(this), TOKEN, amountOut, CURRENCY, amountIn, block.timestamp, block.timestamp + validitySeconds, new bytes(0));
    }

    function getIntentHash(Intent calldata intent) external pure returns (bytes32) {
        return intent.hash();
    }

    /**
     * Stores an order in the Ethereum blockchain as a publicly readable event, so any allowed router
     * can pick it up and execute it against another valid order.
     * 
     * In case the owner configured a specific router to be used, it is usually better to send the
     * order to the configured router directly through a suitable API. Note that all partially filled
     * orders and all filled orders are publicly recorded on-chain anyway, so taking the direct
     * transmission shortcut does not effectively preserve privacy.
     * 
     * To invalidate an order, the owner must call the invalidateNonce function on the SignatureTransfer
     * 
     * contract found in this.ROUTER().TRANSFER().
     */
    function placeOrder(Intent calldata intent, bytes calldata signature) external {
        verifySignature(intent, signature);
        IReactor(REACTOR).signalIntent(intent, signature);
    }

    /**
     * Verify the signature of an order.
     */
    function verifySignature(Intent calldata intent, bytes calldata sig) public view {
        if (intent.filler != address(this)) revert WrongFiller();
        IReactor(REACTOR).verify(intent, sig);
    }

    /**
     * Check if an order can be executed and if yes, returns the maximum amount of the tokenOut.
     */
    function validateOrder(Intent calldata intent, bytes calldata sig) external view returns (uint256 unfilled, uint256 balance, uint256 allowance) {
        verifySignature(intent, sig);
        require((intent.tokenOut == TOKEN && intent.tokenIn == CURRENCY) || (intent.tokenOut == CURRENCY && intent.tokenIn == TOKEN), WrongTokens());

        balance = IERC20(intent.tokenOut).balanceOf(intent.owner);
        allowance = IERC20(intent.tokenOut).allowance(intent.owner, REACTOR);

        uint256 amountTokens = (intent.tokenOut == TOKEN) ? intent.amountOut : intent.amountIn;
        uint256 alreadyFilled = IReactor(REACTOR).getFilledAmount(intent);
        if (alreadyFilled == CANCELLED) revert UserCancelled();
        if (amountTokens <= alreadyFilled) revert AlreadyFilled();
        uint256 remaining = amountTokens - alreadyFilled;

        return (remaining, balance, allowance);
    }

    /**
     * Returns multiple order book entries for an array of intents, avoiding multiple calls.
     * The returned numbers are to be used directly in the order book.
     * Therefore, this function doesn't revert, it returns 0 for unexecutable entries instead.
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
     * This is useful for user interfaces to show how much can be traded right now.
     * This function should never return zero. It should either revert or return a non-zero value.
     */
    function executableAmount(Intent calldata intent) public view returns (uint256) {
        if (intent.tokenOut == TOKEN && intent.tokenIn == CURRENCY) {
            return executableSellAmount(intent);
        } else if (intent.tokenOut == CURRENCY && intent.tokenIn == TOKEN) {
            return executableBuyAmount(intent);
        } else {
            revert WrongTokens();
        }
    }

    /**
     * Internal counterpart of getAvailableForExecution for selling.
     * This is straightforward as we can directly check the token balance and allowance.
     */
    function executableSellAmount(Intent calldata intent) internal view returns (uint256) {
        uint256 alreadyFilled = IReactor(REACTOR).getFilledAmount(intent);
        uint256 balance = IERC20(intent.tokenOut).balanceOf(intent.owner);
        uint256 allowance = IERC20(intent.tokenOut).allowance(intent.owner, REACTOR);

        if (intent.amountOut <= alreadyFilled) return 0;

        uint256 unfilled = intent.amountOut - alreadyFilled;
        uint256 availableInWallet = (balance < allowance) ? balance : allowance;
        uint256 finalAvailable = (unfilled < availableInWallet) ? unfilled : availableInWallet;

        return finalAvailable;
    }

    /**
     * Internal counterpart of getAvailableForExecution for buying.
     * This is slightly more tricky, as we need to check balance/allowance in CURRENCY 
     * but return available amount in TOKENS, so getBid() is used to get the conversion rate.
     */
    function executableBuyAmount(Intent calldata intent) internal view returns (uint256) {
        uint256 alreadyFilled = IReactor(REACTOR).getFilledAmount(intent);
        uint256 bid = IReactor(REACTOR).getBid(intent, 1);
        uint256 balanceInShares = IERC20(intent.tokenOut).balanceOf(intent.owner) / bid;
        uint256 allowanceInShares = IERC20(intent.tokenOut).allowance(intent.owner, REACTOR) / bid;

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
        IReactor(REACTOR).verifyPriceMatch(buyerIntent, sellerIntent);
        uint256 executableSell = executableSellAmount(sellerIntent);
        uint256 executableBuy = executableBuyAmount(buyerIntent);
        return (executableSell < executableBuy) ? executableSell : executableBuy;
    }

    function process(Intent calldata seller, bytes calldata sellerSig, Intent calldata buyer, bytes calldata buyerSig, uint256 tradedAmount) external {
        if (!isOpen) revert MarketClosed();
        if (router != address(0) && msg.sender != router) revert WrongRouter(msg.sender, router);

        uint256 totalExecutionPrice = IReactor(REACTOR).getTotalExecutionPrice(buyer, seller, tradedAmount);
        uint256 totalFee = totalExecutionPrice * tradingFeeBips / 10000;

        IReactor(REACTOR).process(seller, sellerSig, buyer, buyerSig, tradedAmount, totalFee);
        emit Trade(seller.owner, buyer.owner, seller.hash(), buyer.hash(), seller.tokenOut, tradedAmount, seller.tokenIn, totalExecutionPrice, totalFee);
    }

    function cancelIntent(Intent calldata intent) external {
        if (msg.sender != router && msg.sender != owner) revert WrongRouter(msg.sender, router);
        IReactor(REACTOR).cancelIntent(intent);
    }

    /**
     * Withdraw the accumulated fees applying a 50/50 split between the two addresses.
     * 
     * The assumption is that this can be used to collect accumulated trading fees and to pay license fees
     * to Aktionariat in the same transaction for convenience.
     */
    function withdrawFees() external {
        withdrawFees(CURRENCY, IERC20(CURRENCY).balanceOf(address(this)));
    }

    function withdrawFees(address currency, uint256 amount) public onlyOwner {
        uint256 split = amount * licenseShare / 10000;
        IERC20(currency).transfer(owner, amount - split); // rounded up
        IERC20(currency).transfer(LICENSE_FEE_RECIPIENT, split); // rounded down
        emit LicenseFeePaid(currency, LICENSE_FEE_RECIPIENT, split);
    }

}