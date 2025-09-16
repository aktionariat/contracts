// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "../ERC20/IERC20.sol";
import "../utils/Ownable.sol";
import {Intent, IntentHash} from "../lib/IntentHash.sol";

contract Filler is Ownable {

    using IntentHash for Intent;

    IReactor public immutable REACTOR;
    uint16 public constant TRADING_FEE_BIPS = 190;

    event TradingFeeCollected(address currency, uint256 actualFee, uint256 amountReturnedToBuyer);
    event TradingFeeWithdrawn(address currency, address target, uint256 amount);
    event LicenseFeePaid(address currency, address target, uint256 amount);

    error LargerSpreadNeeded(uint256 feesCollected, uint256 requiredMinimum);

    constructor(address owner, address reactor) Ownable(owner) {
        REACTOR = IReactor(reactor);
    }

    /**
     * Calculate the hash of an intent with this filler.
     */
    function calculateHash(address owner, address tokenOut, uint160 amountOut, address tokenIn, uint160 amountIn, uint48 expiration, uint48 nonce, bytes calldata data) public view returns (bytes32) {
        Intent memory intent = Intent(owner, address(this), tokenOut, amountOut, tokenIn, amountIn, expiration, nonce, data);
        return this.calculateHash(intent);
    }

    /**
     * Calculate the hash of an intent with this filler.
     */
    function calculateHash(Intent calldata intent) public pure returns (bytes32) {
        return intent.hash();
    }

    function process(Intent calldata seller, bytes calldata sellerSig, Intent calldata buyer, bytes calldata buyerSig) external {
        address currency = buyer.tokenOut;
        uint256 balanceBefore = IERC20(currency).balanceOf(address(this));
        uint256 buyerBalanceBefore = IERC20(currency).balanceOf(buyer.owner);
        REACTOR.process(address(this), seller, sellerSig, buyer, buyerSig);
        uint256 feesCollected = IERC20(currency).balanceOf(address(this)) - balanceBefore;
        uint256 amountSpent = buyerBalanceBefore - IERC20(currency).balanceOf(buyer.owner);
        uint256 minimumFees = amountSpent * TRADING_FEE_BIPS / 10000;
        // Ensure that we got at least 1.9%
        if (feesCollected < minimumFees) revert LargerSpreadNeeded(feesCollected, minimumFees);
        // The TradeReactor pays out the full spread as a fee to us. However, we only want 1.9%. Who should receive excess fees, if any?
        // The ideal solution would be to give the spread to the trader that came later. However, we cannot trust the caller to provide us with
        // that information and we do not want to add additional fields to the intents of the buyer and seller. This leaves us with the second
        // best option: always let the seller pay, i.e. send spread after fees to the buyer.
        if (feesCollected > minimumFees) IERC20(currency).transfer(buyer.owner, feesCollected - minimumFees);
        emit TradingFeeCollected(currency, minimumFees, feesCollected - minimumFees);
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

interface IReactor {
    function process(address feeRecipient, Intent calldata sellerIntent, bytes calldata sellerSig, Intent calldata buyerIntent, bytes calldata buyerSig) external;
}
