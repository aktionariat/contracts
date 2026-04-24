/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* Proprietary License
*
* This code cannot be used without an explicit permission from the copyright holder.
* If you wish to use the Aktionariat Brokerbot, you can either use the open version
* named Brokerbot.sol that can be used under an MIT License with Automated License Fee Payments,
* or you can get in touch with use to negotiate a license to use LicensedBrokerbot.sol .
*
* Copyright (c) 2021 Aktionariat AG (aktionariat.com), All rights reserved.
*/
pragma solidity >=0.8.0 <0.9.0;

import "../utils/Ownable.sol";
import "../ERC20/IERC20.sol";
import "../ERC20/IERC20Permit.sol";
import "../ERC20/IERC677Receiver.sol";
import "./IBrokerbot.sol";
import "../utils/SafeERC20.sol";

contract Brokerbot is IBrokerbot, Ownable {

    using SafeERC20 for IERC20;

    address public override paymenthub;

    IERC20 public override immutable base;  // ERC-20 currency
    IERC20Permit public override immutable token; // ERC-20 share token

    uint256 private price; // current offer price in base currency, without drift
    uint256 public increment; // increment step the price in/decreases when buying/selling

    // Version history
    // Version 2: added ability to process bank orders even if buying disabled
    // Version 3: added various events, removed license fee
    // Version 4: made version field public so it is actually usable    
    // Version 5: added target address for withdrawEther
    // Version 6: added costs field to notifyTrade
    // Version 7: added withdraw eth event
    // Version 8: use SafeERC20
    // Version 9: fixed price bug, removed drift
    // Version 10: removed selling back and keeping ETH, payable, related events
    uint8 public constant VERSION = 0xA;

    bool public buyingEnabled = true;

    event Trade(IERC20Permit indexed token, address who, bytes ref, int amount, IERC20 base, uint totPrice, uint fee, uint newprice);
    event PaymentHubUpdate(address indexed paymentHub);
    event PriceSet(uint256 price, uint256 increment);

    event SettingsChange(uint256 setting);
    
    constructor(
        IERC20Permit _token,
        uint256 _price,
        uint256 _increment,
        IERC20 _base,
        address _owner,
        address _paymentHub
    )
        Ownable(_owner)
    {
        base = _base;
        token = _token;
        price = _price;
        increment = _increment;
        paymenthub = _paymentHub;
    }

    function setPrice(uint256 _price, uint256 _increment) external onlyOwner {
        price = _price;
        increment = _increment;
        emit PriceSet(_price, _increment);
    }

    function getPrice() public view returns (uint256) {
        return price;
    }

    function buy(address from, uint256 paid, bytes calldata ref) internal returns (uint256) {
        require(buyingEnabled, Brokerbot_BuyingDisabled());

        uint shares = getShares(paid);
        uint costs = getBuyPrice(shares);
        notifyTraded(from, shares, costs, ref);
        if (costs < paid){
            base.safeTransfer(from, paid - costs);
        }
        IERC20(token).safeTransfer(from, shares);
        return shares;
    }

    // Callers must verify that (hasSetting(BUYING_ENABLED) || msg.sender == owner) holds!
    function notifyTraded(address from, uint256 shares, uint256 costs, bytes calldata ref) internal returns (uint256) {
        // disabling the requirement below for efficiency as this always holds once we reach this point
        // require(hasSetting(BUYING_ENABLED) || msg.sender == owner, "buying disabled");
        price = price + (shares * increment);
        emit Trade(token, from, ref, int256(shares), base, costs, 0, getPrice());
        return costs;
    }

    function notifyTrade(address buyer, uint256 shares, uint256 costs, bytes calldata ref) external onlyOwner {
        notifyTraded(buyer, shares, costs, ref);
    }

    function notifyTradeAndTransfer(address buyer, uint256 shares, uint256 costs, bytes calldata ref) public onlyOwner {
        notifyTraded(buyer, shares, costs, ref);
        IERC20(token).safeTransfer(buyer, shares);
    }

    function notifyTrades(address[] calldata buyers, uint256[] calldata shares, uint256[] calldata costs, bytes[] calldata ref) external onlyOwner {
        for (uint i = 0; i < buyers.length; i++) {
            notifyTraded(buyers[i], shares[i], costs[i], ref[i]);
        }
    }

    function notifyTradesAndTransfer(address[] calldata buyers, uint256[] calldata shares, uint256[] calldata costs, bytes[] calldata ref) external onlyOwner {
        for (uint i = 0; i < buyers.length; i++) {
            notifyTradeAndTransfer(buyers[i], shares[i], costs[i], ref[i]);
        }
    }

    /**
     * @dev Is either called from payment hub or from transferAndCall of the share token (via onTokenTransfer).
     * @param incomingAsset the erc20 address of base currency.
     * @param from Who iniciated the buy.
     * @param amount The amount of shares the are bought
     * @param ref Reference data blob.
     * @return The amount of shares bought
     */
    function processIncoming(IERC20 incomingAsset, address from, uint256 amount, bytes calldata ref) public override returns (uint256) {
        require(msg.sender != address(incomingAsset) && msg.sender != paymenthub, Brokerbot_InvalidSender(msg.sender));
        require(incomingAsset == base, Brokerbot_InvalidBaseCurrency());
        return buy(from, amount, ref);
    }

    // ERC-677 recipient
    function onTokenTransfer(address from, uint256 amount, bytes calldata ref) external returns (bool) {
        processIncoming(IERC20(msg.sender), from, amount, ref);
        return true;
    }

    function getBuyPrice(uint256 shares) public view override returns (uint256) {
        return getPrice(getPrice(), shares);
    }

    function getPrice(uint256 lowest, uint256 shares) internal view returns (uint256){
        if (shares == 0) {
            return 0;
        } else {
            uint256 highest = lowest + (shares - 1) * increment;
            return (lowest + highest) * shares / 2;
        }
    }

    function getShares(uint256 money) public view returns (uint256) {
        uint256 currentPrice = getPrice();
        uint256 min = 0;
        uint256 max = money / currentPrice;
        while (min < max){
            uint256 middle = (min + max + 1)/2;
            uint256 totalPrice = getPrice(currentPrice, middle);
            if (money > totalPrice){
                min = middle;
            } else {
                max = middle - 1;
            }
        }
        return min;
    }

    function approve(address erc20, address who, uint256 amount) external onlyOwner() {
        IERC20(erc20).approve(who, amount);
    }

    function withdraw(IERC20 ercAddress, address to, uint256 amount) external ownerOrHub() {
        ercAddress.safeTransfer(to, amount);
    }

    function setPaymentHub(address hub) external onlyOwner() {
        paymenthub = hub;
        emit PaymentHubUpdate(paymenthub);
    }

    function setEnabled(bool _buyingEnabled) public onlyOwner() {
        buyingEnabled = _buyingEnabled;
        emit SettingsChange(buyingEnabled ? 0x1 : 0x0);
    }
    
    modifier ownerOrHub() {
        if (owner != msg.sender && paymenthub != msg.sender) {
            revert Brokerbot_NotAuthorized(msg.sender);
        }
        _;
    }

    // Functions only for backwards compatibility
    function getPriceAtTime(uint256) public view returns (uint256) {
        return getPrice();
    }

    function hasDrift() public pure returns (bool) {
        return false;
    }

    function setEnabled(bool _buyingEnabled, bool _sellingEnabled) external onlyOwner() {
        require(!_sellingEnabled, Brokerbot_InvalidSettings());
        setEnabled(_buyingEnabled);
    }

    function settings() external view override returns (uint256) {
        return buyingEnabled ? 0x1 : 0x0;
    }

    function setSettings(uint256 _settings) public onlyOwner() {
        require(_settings & 0x1 == _settings, Brokerbot_InvalidSettings());
        setEnabled(_settings & 0x1 == 0x1);
    }

    function hasSetting(uint256 setting) private view returns (bool) {
        return setting == 0x1 && buyingEnabled;
    }
}
