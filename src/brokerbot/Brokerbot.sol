/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* MIT License with Automated License Fee Payments
*
* COPYRIGHT (c) 2020 Aktionariat AG (aktionariat.com)
*
* Permission is hereby granted to any person obtaining a copy of this software
* and associated documentation files (the "Software"), to deal in the Software
* without restriction, including without limitation the rights to use, copy,
* modify, merge, publish, distribute, sublicense, and/or sell copies of the
* Software, and to permit persons to whom the Software is furnished to do so,
* subject to the following conditions:
*
* - The above COPYRIGHT notice and this permission notice shall be included in
*   all copies or substantial portions of the Software.
* - All automated license fee payments integrated into this and related Software
*   are preserved.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/
pragma solidity ^0.8.0;

import "../utils/Ownable.sol";
import "../ERC20/IERC20.sol";
import "../ERC20/IERC677Receiver.sol";

contract Brokerbot is Ownable {

    address public paymenthub;

    address public immutable base;  // ERC-20 currency
    address public immutable token; // ERC-20 share token

    address public constant COPYRIGHT = 0x29Fe8914e76da5cE2d90De98a64d0055f199d06D; // Aktionariat AG

    uint256 private price; // current offer price, without drift
    uint256 public increment; // increment

    uint256 public driftStart;
    uint256 public timeToDrift; // seconds until drift pushes price by one drift increment
    int256 public driftIncrement;

    uint8 private constant LICENSEFEEBPS = 90;

    // Note that these settings might be hard-coded in various places, so better not change these values.
    uint8 private constant BUYING_ENABLED = 0x1;
    uint8 private constant SELLING_ENABLED = 0x2;
    // note that in the UI, we call the setting "convert ether", which is the opposite
    uint8 private constant KEEP_ETHER = 0x4;

    // Version history
    // Version 2: added ability to process bank orders even if buying disabled
    uint8 private constant VERSION = 0x2;

    // more bits to be used by payment hub
    uint256 public settings = BUYING_ENABLED | SELLING_ENABLED | (VERSION<<248);

    event Trade(address indexed token, address who, bytes ref, int amount, address base, uint totPrice, uint fee, uint newprice);
    event ChangePaymentHub(address newPaymentHub, address who);

    constructor(
        address _shareToken,
        uint256 _price,
        uint256 _increment,
        address _baseCurrency,
        address _owner,
        address _paymentHub
    )
        Ownable(_owner)
    {
        base = _baseCurrency;
        token = _shareToken;
        price = _price;
        increment = _increment;
        paymenthub = _paymentHub;
        // Should we disabled recoverability in the recovery hub here?
        // No, if someone attacks us, we can always trigger a transfer and recover the tokens as well as the collateral.
    }

    function setPrice(uint256 newPrice, uint256 newIncrement) external onlyOwner {
        anchorPrice(newPrice);
        increment = newIncrement;
    }

    function hasDrift() public view returns (bool) {
        return timeToDrift != 0;
    }

    // secondsPerStep should be negative for downwards drift
    function setDrift(uint256 secondsPerStep, int256 newDriftIncrement) external onlyOwner {
        anchorPrice(getPrice());
        timeToDrift = secondsPerStep;
        driftIncrement = newDriftIncrement;
    }

    function anchorPrice(uint256 currentPrice) private {
        price = currentPrice;
        // rely on time stamp is ok, no exact time stamp needed
        // solhint-disable-next-line not-rely-on-time
        driftStart = block.timestamp;
    }

    function getPrice() public view returns (uint256) {
        // rely on time stamp is ok, no exact time stamp needed
        // solhint-disable-next-line not-rely-on-time
        return getPriceAtTime(block.timestamp);
    }

    function getPriceAtTime(uint256 timestamp) public view returns (uint256) {
        if (hasDrift()){
            uint256 passed = timestamp - driftStart;
            int256 drifted = int256(passed / timeToDrift) * driftIncrement;
            int256 driftedPrice = int256(price) + drifted;
            if (driftedPrice < 0){
                return 0;
            } else {
                return uint256(driftedPrice);
            }
        } else {
            return price;
        }
    }

    function buy(address from, uint256 paid, bytes calldata ref) internal returns (uint256) {
        require(hasSetting(BUYING_ENABLED), "buying disabled");
        uint shares = getShares(paid);
        uint costs = notifyTraded(from, shares, ref);
        if (costs < paid){
            IERC20(base).transfer(from, paid - costs);
        }
        IERC20(token).transfer(from, shares);
        return shares;
    }

    // Callers must verify that (hasSetting(BUYING_ENABLED) || msg.sender == owner) holds!
    function notifyTraded(address from, uint256 shares, bytes calldata ref) internal returns (uint256) {
        // disabling the requirement below for efficiency as this always holds once we reach this point
        // require(hasSetting(BUYING_ENABLED) || msg.sender == owner, "buying disabled");
        uint costs = getBuyPrice(shares);
        price = price + (shares * increment);
        emit Trade(token, from, ref, int256(shares), base, costs, 0, getPrice());
        return costs;
    }

    function notifyTrade(address buyer, uint256 shares, bytes calldata ref) external onlyOwner {
        notifyTraded(buyer, shares, ref);
    }

    function notifyTradeAndTransfer(address buyer, uint256 shares, bytes calldata ref) public onlyOwner {
        notifyTraded(buyer, shares, ref);
        IERC20(token).transfer(buyer, shares);
    }

    function notifyTrades(address[] calldata buyers, uint256[] calldata shares, bytes[] calldata ref) external onlyOwner {
        for (uint i = 0; i < buyers.length; i++) {
            notifyTraded(buyers[i], shares[i], ref[i]);
        }
    }

    function notifyTradesAndTransfer(address[] calldata buyers, uint256[] calldata shares, bytes[] calldata ref) external onlyOwner {
        for (uint i = 0; i < buyers.length; i++) {
            notifyTradeAndTransfer(buyers[i], shares[i], ref[i]);
        }
    }

    /**
     * Payment hub might actually have sent another accepted token, including Ether.
     */
    function processIncoming(address token_, address from, uint256 amount, bytes calldata ref) public payable returns (uint256) {
        require(msg.sender == token_ || msg.sender == base || msg.sender == paymenthub, "invalid calle");
        if (token_ == token){
            return sell(from, amount, ref);
        } else if (token_ == base){
            return buy(from, amount, ref);
        } else {
            require(false, "invalid token");
            return 0;
        }
    }

    // ERC-677 recipient
    function onTokenTransfer(address from, uint256 amount, bytes calldata ref) external returns (bool) {
        processIncoming(msg.sender, from, amount, ref);
        return true;
    }

    // (deprecated ITokenReceiver, still called by old payment hub)
    function onTokenTransfer(address token_, address from, uint256 amount, bytes calldata ref) external {
        processIncoming(token_, from, amount, ref);
    }

    function buyingEnabled() external view returns (bool){
        return hasSetting(BUYING_ENABLED);
    }

    function sellingEnabled() external view returns (bool){
        return hasSetting(SELLING_ENABLED);
    }

    function hasSetting(uint256 setting) private view returns (bool) {
        return settings & setting == setting;
    }

    function isDirectSale(bytes calldata ref) internal pure returns (bool) {
        if (ref.length == 0 || ref.length == 20) {
            return true; // old format
        } else {
            if (ref[0] == bytes1(0x01)){
                return true;
            } else if (ref[0] == bytes1(0x02)) {
                return false;
            } else {
                require(false, "unknown ref");
                return true;
            }
        }
    }


    function sell(address recipient, uint256 amount, bytes calldata ref) internal returns (uint256) {
        require(hasSetting(SELLING_ENABLED), "selling disabled");
        uint256 totPrice = getSellPrice(amount);
        IERC20 baseToken = IERC20(base);
        uint256 fee = getLicenseFee(totPrice);
        price -= amount * increment;
        if (fee > 0){
            baseToken.transfer(COPYRIGHT, fee);
        }
        if (isDirectSale(ref)){
            baseToken.transfer(recipient, totPrice - fee);
        }
        emit Trade(token, recipient, ref, -int256(amount), base, totPrice, fee, getPrice());
        return totPrice;
    }

    function getLicenseFee(uint256 totPrice) public virtual pure returns (uint256) {
        return totPrice * LICENSEFEEBPS / 10000;
    }

    function getSellPrice(uint256 shares) public view returns (uint256) {
        return getPrice(getPrice() - (shares * increment), shares);
    }

    function getBuyPrice(uint256 shares) public view returns (uint256) {
        return getPrice(getPrice(), shares);
    }

    function getPrice(uint256 lowest, uint256 shares) internal view returns (uint256){
        if (shares == 0) {
            return 0;
        } else {
            uint256 highest = lowest + (shares - 1) * increment;
            return ((lowest + highest) / 2) * shares;
        }
    }

    function getShares(uint256 money) public view returns (uint256) {
        uint256 currentPrice = getPrice();
        uint256 min = 0;
        uint256 max = money / currentPrice;
        while (min < max){
            uint256 middle = (min + max)/2;
            uint256 totalPrice = getPrice(currentPrice, middle);
            if (money > totalPrice){
                min = middle + 1;
            } else {
                max = middle;
            }
        }
        return min;
    }

    function withdrawEther(uint256 amount) external ownerOrHub() {
        payable(msg.sender).transfer(amount); // return change
    }

    function approve(address erc20, address who, uint256 amount) external onlyOwner() {
        IERC20(erc20).approve(who, amount);
    }

    function withdraw(address ercAddress, address to, uint256 amount) external ownerOrHub() {
        IERC20(ercAddress).transfer(to, amount);
    }

    function setPaymentHub(address hub) external onlyOwner() {
        paymenthub = hub;
        emit ChangePaymentHub(paymenthub, msg.sender);
    }

    function setSettings(uint256 settings_) external onlyOwner() {
        settings = settings_;
    }

    function setEnabled(bool newBuyingEnabled, bool newSellingEnabled) external onlyOwner() {
        if (newBuyingEnabled != hasSetting(BUYING_ENABLED)){
            settings ^= BUYING_ENABLED;
        }
        if (newSellingEnabled != hasSetting(SELLING_ENABLED)){
            settings ^= SELLING_ENABLED;
        }
    }
    
    modifier ownerOrHub() {
        require(owner == msg.sender || paymenthub == msg.sender, "not owner");
        _;
    }
}