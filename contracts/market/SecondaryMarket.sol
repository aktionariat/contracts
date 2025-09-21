// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./EIP712.sol";
import "../ERC20/IERC20.sol";
import "../utils/Ownable.sol";
import {IReactor} from "./IReactor.sol";
import {Intent} from "./IntentHash.sol";

contract SecondaryMarket is Ownable {

    uint16 public constant ALL = 10000;
    IReactor public immutable REACTOR;
    address public constant LICENSE_FEE_RECIPIENT = 0x29Fe8914e76da5cE2d90De98a64d0055f199d06D;

    event TradingFeeCollected(address currency, uint256 actualFee, address spreadRecipient, uint256 returnedSpread);
    event TradingFeeWithdrawn(address currency, address target, uint256 amount);
    event LicenseFeePaid(address currency, address target, uint256 amount);

    error LargerSpreadNeeded(uint256 feesCollected, uint256 requiredMinimum);
    error WrongFiller();
    error InvalidConfiguration();
    error SignatureExpired(uint256 signatureDeadline);

    // The following fields should fit into one 32B slot, 20 + 2 + 1 + 1 + 4 + 4 = 32
    address public router; // null for any, 20B
    uint16 public tradingFeeBips; // 2B
    uint16 public routerShare; // Share of the trading fee that goes to the router in bips
    uint16 public licenseShare; // Share of the trading fee that goes to the router in bips
    uint24 public openFrom; // Market opening time
    uint24 public openTo; // Market closing time

    constructor(address owner, address reactor, address router_) Ownable(owner) {
        REACTOR = IReactor(reactor);
        licenseShare = 5000; // default license fee is 50% of fees
        router = router_;
        routerShare = 0;
        openFrom = 0;
        openTo = type(uint24).max;
    }

    //// ADMINISTRATION ////
    
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
        if (intent.filler != address(this)) revert WrongFiller();
        REACTOR.signalIntent(intent, signature);
    }

    /**
     * Calculate the hash of an order on this market.
     */
    function calculateHash(address owner, address tokenOut, uint160 amountOut, address tokenIn, uint160 amountIn, uint48 expiration, uint48 nonce) public view returns (bytes32) {
        Intent memory intent = Intent(owner, address(this), tokenOut, amountOut, tokenIn, amountIn, expiration, nonce, new bytes(0));
        return REACTOR.calculateHash(intent);
    }

    /**
     * Verify the validity of an intent.
     */
    function verify(address owner, address tokenOut, uint160 amountOut, address tokenIn, uint160 amountIn, uint48 expiration, uint48 nonce, bytes calldata sig) external view {
        Intent memory intent = Intent(owner, address(this), tokenOut, amountOut, tokenIn, amountIn, expiration, nonce, new bytes(0));
        if (intent.filler != address(this)) revert WrongFiller();
        REACTOR.verify(intent, sig);
    }

    function process(Intent calldata seller, bytes calldata sellerSig, Intent calldata buyer, bytes calldata buyerSig, bool buyerAdvantage) external {
        address currency = buyer.tokenOut;
        uint256 balanceBefore = IERC20(currency).balanceOf(address(this));
        uint256 buyerBalanceBefore = IERC20(currency).balanceOf(buyer.owner);
        REACTOR.process(address(this), seller, sellerSig, buyer, buyerSig);
        uint256 feesCollected = IERC20(currency).balanceOf(address(this)) - balanceBefore;
        uint256 amountSpent = buyerBalanceBefore - IERC20(currency).balanceOf(buyer.owner);
        uint256 minimumFees = amountSpent * tradingFeeBips / ALL;
        if (feesCollected < minimumFees) revert LargerSpreadNeeded(feesCollected, minimumFees);
        // The TradeReactor pays out the full spread as a fee to us. Who should receive excess fees, if any?
        // The ideal solution would be to give the spread to the trader that came later. However, we cannot trust the caller to provide us with
        // that information and we do not want to add additional fields to the intents of the buyer and seller. This leaves us with the second
        // best option: always let the seller pay, i.e. send spread after fees to the buyer.
        address recipient = buyerAdvantage ? buyer.owner : seller.owner;
        if (feesCollected > minimumFees) {
            IERC20(currency).transfer(recipient, feesCollected - minimumFees);
        }
        emit TradingFeeCollected(currency, minimumFees, recipient, feesCollected - minimumFees);
    }

    /**
     * Withdraw the accumulated fees applying a 50/50 split between the two addresses.
     * 
     * The assumption is that this can be used to collect accumulated trading fees and to pay license fees
     * to Aktionariat in the same transaction for convenience.
     */
    function withdrawFees(address currency, address licensor) external onlyOwner {
        withdrawFees(currency, IERC20(currency).balanceOf(address(this)), owner, licensor, 5000);
    }

    function withdrawFees(address currency, uint256 amount, address owner, address licensor, uint16 splitBips) public onlyOwner {
        uint256 split = amount * splitBips / 10000;
        IERC20(currency).transfer(owner, amount - split); // rounded up
        IERC20(currency).transfer(licensor, split); // rounded down
        emit TradingFeeWithdrawn(currency, owner, amount);
        emit LicenseFeePaid(currency, licensor, split);
    }

}