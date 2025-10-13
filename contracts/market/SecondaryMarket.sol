// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./OrderTracker.sol";
import "../ERC20/IERC20.sol";
import "../utils/Ownable.sol";
import {IReactor} from "./IReactor.sol";
import {Intent} from "./IntentHash.sol";

contract SecondaryMarket is Ownable {

    uint16 public constant ALL = 10000;
    address public constant REACTOR = address(0x0); // TODO: set the reactor address here
    address public constant LICENSE_FEE_RECIPIENT = 0x29Fe8914e76da5cE2d90De98a64d0055f199d06D;

    address public immutable CURRENCY;
    address public immutable TOKEN;

    event TradingFeeCollected(address currency, uint256 actualFee, address spreadRecipient, uint256 returnedSpread);
    event TradingFeeWithdrawn(address currency, address target, uint256 amount);
    event LicenseFeePaid(address currency, address target, uint256 amount);
    event TradingWindow(uint24 from, uint24 to);
    event Trade(address indexed seller, address indexed buyer, address token, uint256 tokenAmount, address currency, uint256 currencyAmount, uint256 fees);

    error LargerSpreadNeeded(uint256 feesCollected, uint256 requiredMinimum);
    error WrongFiller();
    error WrongTokens();
    error WrongRouter(address expected, address actual);
    error InvalidConfiguration();
    error MarketClosed(uint256 openFrom, uint256 openTo, uint256 nowTime);
    error NoBalance(address token, address owner);
    error NoAllowance(address token, address owner, address spender);
    error NonceUsed(address owner, uint256 nonce);

    // The following fields should fit into one 32B slot, 20 + 2 + 1 + 1 + 4 + 4 = 32
    address public router; // null for any, 20B
    uint16 public tradingFeeBips; // 2B
    uint16 public routerShare; // Share of the trading fee that goes to the router in bips
    uint16 public licenseShare; // Share of the trading fee that goes to the router in bips
    uint24 public openFrom; // Market opening time
    uint24 public openTo; // Market closing time

    constructor(address owner, address currency, address token, address router_) Ownable(owner) {
        CURRENCY = currency;
        TOKEN = token;
        licenseShare = 5000; // default license fee is 50% of fees
        router = router_;
        routerShare = 0;
        openFrom = 0;
        openTo = type(uint24).max;
    }

    //// ADMINISTRATION ////

    function isOpen() public view returns (bool) {
        return block.timestamp >= openFrom && block.timestamp < openTo;
    }
    
    /**
     * Opens the market.
     */
    function open() onlyOwner external {
        setTradingWindow(0, type(uint24).max);
    }

    /**
     * Closes the market.
     */
    function close() onlyOwner external {
        setTradingWindow(0, 0);
    }

    /**
     * Opens the market for a limited amount of time.
     * @param openTime The time in seconds since 1970-01-01 the market opens.
     * @param window The dureation in seconds for which the market stays open.
     */
    function setTradingWindow(uint24 openTime, uint24 window) onlyOwner public {
        openFrom = openTime;
        openTo = openTime + window;
        emit TradingWindow(openFrom, openTo);
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
    function createBuyOrder(address owner, uint160 amountOut, uint160 amountIn, uint24 validitySeconds) public view returns (Intent memory) {
        return Intent(owner, address(this), CURRENCY, amountOut, TOKEN, amountIn, uint48(block.timestamp + validitySeconds), findFreeNonce(owner), new bytes(0));
    }

    /**
     * Create an order intent that can be signed by the owner.
     * The tokenIn amount is reduced by the trading fee, which is always charged to the seller.
     */
    function createSellOrder(address owner, uint160 amountOut, uint160 amountIn, uint24 validitySeconds) public view returns (Intent memory) {
        return Intent(owner, address(this), TOKEN, amountOut, CURRENCY, amountIn * (10000 - tradingFeeBips) / 10000, uint48(block.timestamp + validitySeconds), findFreeNonce(owner), new bytes(0));
    }

    /**
     * Calculate the hash to be signed.
     */
    function calculateHash(Intent calldata intent) public view returns (bytes32) {
        return IReactor(REACTOR).calculateHash(intent);
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
    function validateOrder(Intent calldata intent, bytes calldata sig) external view returns (uint256) {
        verifySignature(intent, sig);
        require((intent.tokenOut == TOKEN && intent.tokenIn == CURRENCY) || (intent.tokenOut == CURRENCY && intent.tokenIn == TOKEN), WrongTokens());

        uint256 balance = IERC20(intent.tokenOut).balanceOf(intent.owner);
        if (balance == 0) revert NoBalance(intent.tokenOut, intent.owner);

        uint256 allowance = IERC20(intent.tokenOut).allowance(intent.owner, REACTOR);
        if (allowance == 0) revert NoAllowance(intent.tokenOut, intent.owner, REACTOR);

        uint256 permitted = ISignatureTransfer(REACTOR).getPermittedAmount(intent.owner, intent.amountOut, intent.nonce);
        if (permitted == 0) revert NonceUsed(intent.owner, intent.nonce);

        return permitted;
    }

    /**
     * Validates a match between a seller and a buyer intent and returns the maximum amount of tokens that can be traded.
     */
    function validateMatch(Intent calldata sellerIntent, Intent calldata buyerIntent) external view returns (uint256) {
        return IReactor(REACTOR).getMaxValidAmount(sellerIntent, buyerIntent, tradingFeeBips);
    }

    function process(Intent calldata seller, bytes calldata sellerSig, Intent calldata buyer, bytes calldata buyerSig, uint256 tradedTokens, bool buyerIsTaker) external {
        if (!isOpen()) revert MarketClosed(openFrom, openTo, block.timestamp);
        if (router != address(0) && msg.sender != router) revert WrongRouter(msg.sender, router);



        (uint256 proceeds, uint256 spread) = IReactor(REACTOR).process(seller, sellerSig, buyer, buyerSig, tradedTokens);
        uint256 price = buyerIsTaker ? proceeds * 10000 / (10000 - tradingFeeBips) : proceeds + spread;
        splitSpread(buyer.owner, seller, tradedTokens, price, buyerIsTaker ? buyer.owner : seller.owner, spread);
    }

    function splitSpread(address buyer, Intent calldata seller, uint256 tradedTokens, uint256 price, address spreadRecipient, uint256 spread) internal {
        uint256 fees = tradingFeeBips * price / 10000;
        emit Trade(seller.owner, buyer, seller.tokenOut, tradedTokens, seller.tokenIn, price, fees);
        if (spread > fees) {
            IERC20(seller.tokenIn).transfer(spreadRecipient, spread - fees); // return excess spread to the taker who entered the order later
        }
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