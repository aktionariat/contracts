/**
 * SPDX-License-Identifier: LicenseRef-Aktionariat
 *
 * MIT License with Automated License Fee Payments
 *
 * Copyright (c) 2026 Aktionariat AG (aktionariat.com)
 *
 * Permission is hereby granted to any person obtaining a copy of this software
 * and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy,
 * modify, merge, publish, distribute, sublicense, and/or sell copies of the
 * Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * - The above copyright notice and this permission notice shall be included in
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
pragma solidity >=0.8.0 <0.9.0;

import "../utils/Ownable.sol";
import "../ERC20/ERC20Allowlistable.sol";
import "./lib/BytecodeStore.sol";
import "./lib/Create3.sol";

/**
 * @title Aktionariat Factory
 * @author Murat Ögat, murat@aktionariat.com
 *
 * Deploys a company's contracts on the home chain (Shares, SharesUnderAgreement, optional DirectInvestment and
 * SecondaryMarket) and the bridged wrapper on other chains. Every contract is created with CREATE3, so its
 * address depends only on this factory's address and the ticker. The factory itself is deployed at the same
 * address on every chain, which gives the wrapper and its bridged twin the same address everywhere.
 *
 * The bytecodes live in separate stores that the owner can replace per chain. The factory owns the tokens
 * for the duration of the deployment, applies the allowlist regime, and hands them to the issuer's multisig.
 */
contract AktionariatFactory is Ownable {

    uint8 public constant VERSION = 1;
    uint256 public constant HOME_CHAIN_ID = 1;

    // Base token salt = keccak(ticker); the others append a suffix (and an index for DirectInvestment).
    // The wrapper suffix is shared with the bridged token.
    bytes32 public constant SALT_SUFFIX_SHA = keccak256("SHA");
    bytes32 public constant SALT_SUFFIX_DIRECT_INVESTMENT = keccak256("DirectInvestment");
    bytes32 public constant SALT_SUFFIX_SECONDARY_MARKET = keccak256("SecondaryMarket");

    struct CompanyParams {
        string ticker;       // base token symbol, also the salt of every contract of this company
        string name;
        string terms;
        string wrapperTerms;
        bool restricted;     // transfer restrictions applicable from birth
        address owner;       // the issuer's multisig
    }

    struct DirectInvestmentParams {
        uint256 price;
        uint256 increment;
    }

    struct Company {
        address base;
        address wrapper;
        address directInvestment;
        address market;
    }

    struct Versions {
        uint256 factory;
        uint256 shares;
        uint256 sharesUnderAgreement;
        uint256 bridgedSharesUnderAgreement;
        uint256 directInvestment;
        uint256 secondaryMarket;
    }

    BytecodeStore public sharesFactory;
    BytecodeStore public sharesUnderAgreementFactory;
    BytecodeStore public bridgedSharesUnderAgreementFactory;
    BytecodeStore public directInvestmentFactory;
    BytecodeStore public secondaryMarketFactory;

    address public paymentHub;
    address public router;
    address public currency;

    event CompanyDeployed(string ticker, address indexed owner, address base, address wrapper);
    event DirectInvestmentDeployed(address indexed token, address directInvestment);
    event SecondaryMarketDeployed(address indexed token, address market);
    event BridgedTokenDeployed(string ticker, address indexed owner, address token);
    event SettingChanged(string key, address value);

    error NotHomeChain();
    error HomeChain();
    error OwnerRequired();
    error StoreNotSet(string key);

    constructor(address deployer) Ownable(deployer) {}

    // Deployment, home chain

    function deployCompany(CompanyParams calldata p) external onlyOwner returns (Company memory c) {
        c = _deployTokens(p);
        _handOver(c, p.owner);
    }

    function deployCompanyWithDirectInvestment(CompanyParams calldata p, DirectInvestmentParams calldata d) external onlyOwner returns (Company memory c) {
        c = _deployTokens(p);
        c.directInvestment = _deployDirectInvestment(p.ticker, c.wrapper, p.owner, d, 0, p.restricted);
        _handOver(c, p.owner);
    }

    function deployCompanyWithDirectInvestmentAndSecondaryMarket(CompanyParams calldata p, DirectInvestmentParams calldata d) external onlyOwner returns (Company memory c) {
        c = _deployTokens(p);
        c.directInvestment = _deployDirectInvestment(p.ticker, c.wrapper, p.owner, d, 0, p.restricted);
        c.market = _deploySecondaryMarket(p.ticker, c.wrapper, p.owner, p.restricted);
        _handOver(c, p.owner);
    }

    // Later additions to an existing company. The factory no longer owns the wrapper, so under a restricted
    // regime the issuer types the new contract ALLOWED afterwards.

    function addDirectInvestment(string calldata ticker, DirectInvestmentParams calldata d, uint256 index) external onlyOwner returns (address) {
        address wrapper = _wrapperAddress(ticker);
        return _deployDirectInvestment(ticker, wrapper, Ownable(wrapper).owner(), d, index, false);
    }

    function addSecondaryMarket(string calldata ticker) external onlyOwner returns (address) {
        address wrapper = _wrapperAddress(ticker);
        return _deploySecondaryMarket(ticker, wrapper, Ownable(wrapper).owner(), false);
    }

    // Deployment, other chains: the bridged wrapper lands on the home-chain wrapper's address.

    function deployBridgedToken(string calldata ticker, string calldata symbol, string calldata name, string calldata terms, bool restricted, address owner_) external onlyOwner returns (address token) {
        if (block.chainid == HOME_CHAIN_ID) revert HomeChain();
        if (owner_ == address(0)) revert OwnerRequired();
        token = Create3.deploy(_salt(ticker, SALT_SUFFIX_SHA), _initCode(bridgedSharesUnderAgreementFactory, "bridgedSharesUnderAgreementFactory", abi.encode(symbol, name, terms, address(this))));
        if (restricted) ERC20Allowlistable(token).setApplicable(true);
        Ownable(token).transferOwnership(owner_);
        emit BridgedTokenDeployed(ticker, owner_, token);
    }

    // Prediction, a pure function of the ticker

    function predictCompany(string calldata ticker) external view returns (Company memory c) {
        c.base = Create3.predict(_salt(ticker));
        c.wrapper = _wrapperAddress(ticker);
        c.directInvestment = predictDirectInvestment(ticker, 0);
        c.market = Create3.predict(_salt(ticker, SALT_SUFFIX_SECONDARY_MARKET));
    }

    function predictDirectInvestment(string calldata ticker, uint256 index) public view returns (address) {
        return Create3.predict(_salt(ticker, SALT_SUFFIX_DIRECT_INVESTMENT, index));
    }

    // Settings, per chain

    function setSharesFactory(BytecodeStore store) external onlyOwner { sharesFactory = store; emit SettingChanged("sharesFactory", address(store)); }
    function setSharesUnderAgreementFactory(BytecodeStore store) external onlyOwner { sharesUnderAgreementFactory = store; emit SettingChanged("sharesUnderAgreementFactory", address(store)); }
    function setBridgedSharesUnderAgreementFactory(BytecodeStore store) external onlyOwner { bridgedSharesUnderAgreementFactory = store; emit SettingChanged("bridgedSharesUnderAgreementFactory", address(store)); }
    function setDirectInvestmentFactory(BytecodeStore store) external onlyOwner { directInvestmentFactory = store; emit SettingChanged("directInvestmentFactory", address(store)); }
    function setSecondaryMarketFactory(BytecodeStore store) external onlyOwner { secondaryMarketFactory = store; emit SettingChanged("secondaryMarketFactory", address(store)); }
    function setPaymentHub(address hub) external onlyOwner { paymentHub = hub; emit SettingChanged("paymentHub", hub); }
    function setRouter(address router_) external onlyOwner { router = router_; emit SettingChanged("router", router_); }
    function setCurrency(address currency_) external onlyOwner { currency = currency_; emit SettingChanged("currency", currency_); }

    function versions() external view returns (Versions memory v) {
        v.factory = VERSION;
        v.shares = _version(sharesFactory);
        v.sharesUnderAgreement = _version(sharesUnderAgreementFactory);
        v.bridgedSharesUnderAgreement = _version(bridgedSharesUnderAgreementFactory);
        v.directInvestment = _version(directInvestmentFactory);
        v.secondaryMarket = _version(secondaryMarketFactory);
    }

    // Internals

    function _deployTokens(CompanyParams calldata p) private returns (Company memory c) {
        if (block.chainid != HOME_CHAIN_ID) revert NotHomeChain();
        if (p.owner == address(0)) revert OwnerRequired();
        c.base = Create3.deploy(_salt(p.ticker), _initCode(sharesFactory, "sharesFactory", abi.encode(p.ticker, p.name, p.terms, address(this))));
        c.wrapper = Create3.deploy(_salt(p.ticker, SALT_SUFFIX_SHA), _initCode(sharesUnderAgreementFactory, "sharesUnderAgreementFactory", abi.encode(c.base, p.wrapperTerms, address(this))));
        if (p.restricted) {
            ERC20Allowlistable(c.base).setApplicable(true);
            ERC20Allowlistable(c.wrapper).setApplicable(true);
            // The wrapper pays base tokens back to its own holders after termination; they all passed its gate.
            ERC20Allowlistable(c.base).setType(c.wrapper, ERC20Allowlistable(c.base).TYPE_ADMIN());
        }
        emit CompanyDeployed(p.ticker, p.owner, c.base, c.wrapper);
    }

    function _deployDirectInvestment(string calldata ticker, address wrapper, address owner_, DirectInvestmentParams calldata d, uint256 index, bool restricted) private returns (address di) {
        di = Create3.deploy(_salt(ticker, SALT_SUFFIX_DIRECT_INVESTMENT, index), _initCode(directInvestmentFactory, "directInvestmentFactory", abi.encode(wrapper, d.price, d.increment, currency, owner_, paymentHub)));
        if (restricted) _allow(wrapper, di);
        emit DirectInvestmentDeployed(wrapper, di);
    }

    function _deploySecondaryMarket(string calldata ticker, address wrapper, address owner_, bool restricted) private returns (address market) {
        market = Create3.deploy(_salt(ticker, SALT_SUFFIX_SECONDARY_MARKET), _initCode(secondaryMarketFactory, "secondaryMarketFactory", abi.encode(owner_, currency, wrapper, router)));
        if (restricted) _allow(wrapper, market);
        emit SecondaryMarketDeployed(wrapper, market);
    }

    // Intermediaries facing outside addresses are ALLOWED, not ADMIN: they may only pay out to holders the issuer typed.
    function _allow(address token, address intermediary) private {
        ERC20Allowlistable(token).setType(intermediary, ERC20Allowlistable(token).TYPE_ALLOWED());
    }

    function _handOver(Company memory c, address owner_) private {
        Ownable(c.base).transferOwnership(owner_);
        Ownable(c.wrapper).transferOwnership(owner_);
    }

    function _initCode(BytecodeStore store, string memory key, bytes memory constructorArgs) private pure returns (bytes memory) {
        if (address(store) == address(0)) revert StoreNotSet(key);
        return abi.encodePacked(store.creationCode(), constructorArgs);
    }

    function _version(BytecodeStore store) private pure returns (uint256) {
        return address(store) == address(0) ? 0 : store.version();
    }

    function _wrapperAddress(string calldata ticker) private view returns (address) {
        return Create3.predict(_salt(ticker, SALT_SUFFIX_SHA));
    }

    function _salt(string calldata ticker) private pure returns (bytes32) {
        return keccak256(bytes(ticker));
    }

    function _salt(string calldata ticker, bytes32 suffix) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(ticker, suffix));
    }

    function _salt(string calldata ticker, bytes32 suffix, uint256 index) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(ticker, suffix, index));
    }
}
