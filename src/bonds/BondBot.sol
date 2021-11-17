/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* MIT License with Automated License Fee Payments
*
* COPYRIGHT (c) 2021 Aktionariat AG (aktionariat.com)
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

import "../Ownable.sol";
import "../IERC20.sol";
import "../ITokenReceiver.sol";
import "../IERC677Receiver.sol";
import "./Bond.sol";

contract BondBot is Ownable {

    address public paymenthub;
    
    address public immutable base;  // ERC-20 currency
    address public immutable token; // ERC-20 bond token

    address public constant COPYRIGHT = 0x29Fe8914e76da5cE2d90De98a64d0055f199d06D; // Aktionariat AG

    uint256 private price; // current offer price, without drift
    uint256 public driftStart;
    uint256 public timeToDrift; // seconds until drift pushes price by one drift increment
    int256 public driftIncrement;

    uint8 private constant LICENSE_FEE_BPS = 90;

    uint8 private constant BUYING_ENABLED = 0x1;
    uint8 private constant SELLING_ENABLED = 0x2;

    // more bits to be used by payment hub
    uint256 public settings = BUYING_ENABLED | SELLING_ENABLED;

    event Trade(address indexed token, address who, bytes ref, int amount, address base, uint totPrice, uint fee, uint newprice);

    constructor(address bondToken, uint256 price_, address baseCurrency, address _owner) Ownable(_owner){
        base = baseCurrency;
        token = bondToken;
        price = price_;
        paymenthub = address(0x3eABee781f6569328143C610700A99E9ceE82cba);
    }

    modifier ownerOrHub() {
        require(owner == msg.sender || paymenthub == msg.sender, "not owner");
        _;
    }

    function setPrice(uint256 newPrice) external onlyOwner {
        anchorPrice(newPrice);
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
        driftStart = block.timestamp;
    }

    function getPrice(uint256 bonds) public view returns (uint256) {
        return getPrice() * bonds;
    }

    function getPrice() public view returns (uint256) {
        return getPriceAtTime(block.timestamp);
    }

    function getPriceAtTime(uint256 timestamp) public view returns (uint256) {
        if (hasDrift()) {
            uint256 passed = timestamp - driftStart;
            int256 drifted = int256(passed / timeToDrift) * driftIncrement;
            int256 driftedPrice = int256(price) + drifted;
            if (driftedPrice < 0){
                return 0;
            } else {
                return uint256(driftedPrice);
            }
        }else {
            return price;
        }
    }

    function buy(address from, uint256 paid, bytes calldata ref) internal returns (uint256) {
        uint bonds = getBonds(paid);
        uint costs = notifyTraded(from, bonds, ref);
        if (costs < paid){
            IERC20(base).transfer(from, paid - costs);
        }
        Bond(token).mint(from, bonds);
        return bonds;
    }

    function notifyTraded(address from, uint256 bonds, bytes calldata ref) internal returns (uint256) {
        require(hasSetting(BUYING_ENABLED));
        uint costs = getPrice(bonds);
        emit Trade(token, from, ref, int256(bonds), base, costs, 0, getPrice());
        return costs;
    }

    function notifyTrade(address buyer, uint256 bonds, bytes calldata ref) external onlyOwner {
        notifyTraded(buyer, bonds, ref);
    }

    function notifyTradeAndTransfer(address buyer, uint256 bonds, bytes calldata ref) public onlyOwner {
        notifyTraded(buyer, bonds, ref);
        IERC20(token).transfer(buyer, bonds);
    }

    function notifyTrades(address[] calldata buyers, uint256[] calldata bonds, bytes[] calldata ref) external onlyOwner {
        for (uint i = 0; i < buyers.length; i++) {
            notifyTraded(buyers[i], bonds[i], ref[i]);
        }
    }

    function notifyTradesAndTransfer(address[] calldata buyers, uint256[] calldata bonds, bytes[] calldata ref) external onlyOwner {
        for (uint i = 0; i < buyers.length; i++) {
            notifyTradeAndTransfer(buyers[i], bonds[i], ref[i]);
        }
    }

    /**
     * Payment hub might actually have sent another accepted token, including Ether.
     */
    function processIncoming(address token_, address from, uint256 amount, bytes calldata ref) public payable returns (uint256) {
        require(msg.sender == token_ || msg.sender == base || msg.sender == paymenthub);
        if (token_ == token){
            return sell(from, amount, ref);
        } else if (token_ == base){
            return buy(from, amount, ref);
        } else {
            require(false);
            return 0;
        }
    }

    // ERC-677 recipient
    function onTokenTransfer(address from, uint256 amount, bytes calldata ref) external returns (bool) {
        processIncoming(msg.sender, from, amount, ref);
        return true;
    }

    // ITokenReceiver
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

    function sell(address recipient, uint256 amount, bytes calldata ref) internal returns (uint256) {
        require(hasSetting(SELLING_ENABLED));
        uint256 totPrice = getPrice(amount);
        IERC20 baseToken = IERC20(base);
        uint256 fee = getLicenseFee(totPrice);
        if (fee > 0){
            baseToken.transfer(COPYRIGHT, fee);
        }
        baseToken.transfer(recipient, totPrice - fee);
        emit Trade(token, recipient, ref, -int256(amount), base, totPrice, fee, getPrice());
        return totPrice;
    }

    function getLicenseFee(uint256 totPrice) public pure returns (uint256) {
        return totPrice * LICENSE_FEE_BPS / 10000;
    }

    function getBonds(uint256 money) public view returns (uint256) {
        return money / getPrice();
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
        require(hub != address(0), "address must not be 0");
        paymenthub = hub;
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
}