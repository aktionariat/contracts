/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* Proprietary License
*
* This code cannot be used without an explicit permission from the copyright holder.
* If you wish to use the Aktionariat Direct Investment Contract, you can either use the open version
* named DirectInvestment.sol that can be used under an MIT License with Automated License Fee Payments,
* or you can get in touch with use to negotiate a license.
*
* Copyright (c) 2021 Aktionariat AG (aktionariat.com), All rights reserved.
*/
pragma solidity >=0.8.0 <0.9.0;

import "./IDirectInvestment.sol";
import "../utils/Ownable.sol";
import "../ERC20/IERC20.sol";
import "../utils/SafeERC20.sol";

contract DirectInvestment is IDirectInvestment, Ownable {

    using SafeERC20 for IERC20;

    address public override paymenthub;

    IERC20 public override immutable base;  // ERC-20 currency
    IERC20 public override immutable token; // ERC-20 share token

    uint256 public price;       // current offer price in base currency
    uint256 public increment;   // increment step the price in/decreases when buying/selling

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
    uint8 public constant VERSION = 10;

    bool public buyingEnabled = true;

    event Trade(IERC20 indexed token, address who, bytes ref, uint256 amount, IERC20 base, uint256 totalPrice, uint256 fee, uint256 newprice);
    event PaymentHubUpdate(address indexed paymentHub);
    event PriceSet(uint256 price, uint256 increment);
    event SettingsChange(uint256 setting);
    
    constructor(
        IERC20 _token,
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

    function getBuyPrice(uint256 shares) public view override returns (uint256) {
        if (shares == 0) {
            return 0;
        } else {
            uint256 highest = price + (shares - 1) * increment;
            return (price + highest) * shares / 2;
        }
    }

    // Delivers the shares to the buyer.
    // Can be called by the owner multisig or the PaymentHub.abi
    // PaymentHub must make sure that the payment is sent before calling this function and the exact correct amount has been paid.
    function deliverShares(address buyer, uint256 amountShares, uint256 amountBaseCurrency, bytes calldata ref) internal {
        require(buyingEnabled, DirectInvestment_BuyingDisabled());

        IERC20(token).safeTransfer(buyer, amountShares);
        price = price + (amountShares * increment);

        emit Trade(token, buyer, ref, amountShares, base, amountBaseCurrency, 0, price);
    }
    
    /// The actual methods calling deliverShares.

    // notifyTradeAndTransfer can be used by the owner multisig to deliver shares for off-chain payments, e.g. bank transfers. 
    // The issuer needs to make sure that the payment is received before calling this function through the multisig.
    // This can be called with any amountBaseCurrency, as the issuer checks the money received, and to avoid errors with increment
    function notifyTradeAndTransfer(address buyer, uint256 amountShares, uint256 amountBaseCurrency, bytes calldata ref) public onlyOwner {
        deliverShares(buyer, amountShares, amountBaseCurrency, ref);
    }

    function notifyTradesAndTransfer(address[] calldata buyers, uint256[] calldata amountShares, uint256[] calldata amountBaseCurrency, bytes[] calldata ref) external onlyOwner {
        for (uint i = 0; i < buyers.length; i++) {
            deliverShares(buyers[i], amountShares[i], amountBaseCurrency[i], ref[i]);
        }
    }

    // processIncoming can be called only by the PaymentHub, after making sure the payment has been transferred to this contract.
    // This needs to be called with the exact amount of base currency paid.
    function processIncoming(address buyer, uint256 amountShares, uint256 amountBaseCurrency, bytes calldata ref) public override onlyPaymentHub {
        uint256 executionPrice = getBuyPrice(amountShares);
        require(amountBaseCurrency == executionPrice, DirectInvestment_InsufficientPayment(executionPrice, amountBaseCurrency));

        deliverShares(buyer, amountShares, amountBaseCurrency, ref);
    }

    function withdraw(IERC20 ercAddress, address to, uint256 amount) external onlyOwner() {
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
    
    modifier onlyPaymentHub() {
        require(msg.sender == paymenthub, DirectInvestment_NotPaymentHub(msg.sender));
        _;
    }

    // TODO - Migration functions



    // Functions only for backwards compatibility
    function getPriceAtTime(uint256) public view returns (uint256) {
        return price;
    }

    function hasDrift() public pure returns (bool) {
        return false;
    }

    function setEnabled(bool _buyingEnabled, bool _sellingEnabled) external onlyOwner() {
        require(!_sellingEnabled, DirectInvestment_InvalidSettings());
        setEnabled(_buyingEnabled);
    }

    function settings() external view returns (uint256) {
        return buyingEnabled ? 0x1 : 0x0;
    }

    function setSettings(uint256 _settings) public onlyOwner() {
        require(_settings & 0x1 == _settings, DirectInvestment_InvalidSettings());
        setEnabled(_settings & 0x1 == 0x1);
    }

    function hasSetting(uint256 setting) private view returns (bool) {
        return setting == 0x1 && buyingEnabled;
    }
}
