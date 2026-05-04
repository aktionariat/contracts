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

    /// @notice Set the per-share offer price and the linear increment applied per share sold.
    function setPrice(uint256 _price, uint256 _increment) external onlyOwner {
        price = _price;
        increment = _increment;
        emit PriceSet(_price, _increment);
    }

    /// @notice Total cost in base currency to buy `shares` at the current price and increment.
    function getBuyPrice(uint256 shares) public view override returns (uint256) {
        if (shares == 0) {
            return 0;
        } else {
            uint256 highest = price + (shares - 1) * increment;
            return (price + highest) * shares / 2;
        }
    }

    /// @dev Bumps price, then transfers shares. Caller must have ensured payment is settled.
    function deliverShares(address buyer, uint256 amountShares, uint256 amountBaseCurrency, bytes calldata ref) internal {
        require(buyingEnabled, DirectInvestment_BuyingDisabled());

        price = price + (amountShares * increment);
        IERC20(token).safeTransfer(buyer, amountShares);

        emit Trade(token, buyer, ref, amountShares, base, amountBaseCurrency, 0, price);
    }
    
    /// @notice Owner-triggered settlement for off-chain payments (e.g. bank transfers).
    /// @dev `amountBaseCurrency` is informational; the issuer verifies the payment off-chain.
    function notifyTradeAndTransfer(address buyer, uint256 amountShares, uint256 amountBaseCurrency, bytes calldata ref) public onlyOwner {
        deliverShares(buyer, amountShares, amountBaseCurrency, ref);
    }

    /// @notice Batch version of `notifyTradeAndTransfer`.
    function notifyTradesAndTransfer(address[] calldata buyers, uint256[] calldata amountShares, uint256[] calldata amountBaseCurrency, bytes[] calldata ref) external onlyOwner {
        for (uint i = 0; i < buyers.length; i++) {
            deliverShares(buyers[i], amountShares[i], amountBaseCurrency[i], ref[i]);
        }
    }

    /// @notice Settle an on-chain payment routed through the PaymentHub and deliver shares.
    /// @dev PaymentHub must transfer exactly `getBuyPrice(amountShares)` of base currency before calling.
    function processIncoming(address buyer, uint256 amountShares, uint256 amountBaseCurrency, bytes calldata ref) public override onlyPaymentHub {
        uint256 executionPrice = getBuyPrice(amountShares);
        require(amountBaseCurrency == executionPrice, DirectInvestment_InsufficientPayment(executionPrice, amountBaseCurrency));

        deliverShares(buyer, amountShares, amountBaseCurrency, ref);
    }

    /// @notice Owner withdrawal of any ERC20 held by this contract.
    function withdraw(IERC20 ercAddress, address to, uint256 amount) external onlyOwner() {
        ercAddress.safeTransfer(to, amount);
    }

    /// @notice Update the PaymentHub authorized to settle on-chain trades.
    function setPaymentHub(address hub) external onlyOwner() {
        paymenthub = hub;
        emit PaymentHubUpdate(paymenthub);
    }

    /// @notice Enable or disable on-chain buying.
    function setEnabled(bool _buyingEnabled) public onlyOwner() {
        buyingEnabled = _buyingEnabled;
        emit SettingsChange(buyingEnabled ? 0x1 : 0x0);
    }

    /// @notice Move all token and base balances to a successor contract and disable buying.
    function migrate(address directInvestmentContract) external onlyOwner() {
        IERC20(token).safeTransfer(directInvestmentContract, token.balanceOf(address(this)));
        IERC20(base).safeTransfer(directInvestmentContract, base.balanceOf(address(this)));
        buyingEnabled = false;
    }

    /// @dev Restricts access to the configured PaymentHub.
    modifier onlyPaymentHub() {
        require(msg.sender == paymenthub, DirectInvestment_NotPaymentHub(msg.sender));
        _;
    }

    // Functions only for backwards compatibility

    /// @dev Backwards-compat shim. Price has no time dependence.
    function getPriceAtTime(uint256) public view returns (uint256) {
        return price;
    }

    /// @dev Backwards-compat shim. Drift was removed in v9.
    function hasDrift() public pure returns (bool) {
        return false;
    }

    /// @dev Backwards-compat shim. Reverts if `_sellingEnabled` is true (selling no longer supported).
    function setEnabled(bool _buyingEnabled, bool _sellingEnabled) external onlyOwner() {
        require(!_sellingEnabled, DirectInvestment_InvalidSettings());
        setEnabled(_buyingEnabled);
    }

    /// @dev Backwards-compat shim. Settings bitfield reduced to bit 0 = buying enabled.
    function settings() external view returns (uint256) {
        return buyingEnabled ? 0x1 : 0x0;
    }

    /// @dev Backwards-compat shim. Accepts the legacy settings bitfield.
    function setSettings(uint256 _settings) public onlyOwner() {
        require(_settings & 0x1 == _settings, DirectInvestment_InvalidSettings());
        setEnabled(_settings & 0x1 == 0x1);
    }
}
