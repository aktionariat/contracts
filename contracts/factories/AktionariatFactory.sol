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
import "../shares/sha/BridgedSharesUnderAgreement.sol";
import "./lib/BytecodeStore.sol";
import "./lib/Create2.sol";
import "./lib/Create3.sol";
import {TokenPool} from "@chainlink/contracts-ccip/contracts/pools/TokenPool.sol";
import {ERC20LockBox} from "@chainlink/contracts-ccip/contracts/pools/ERC20LockBox.sol";
import {RateLimiter} from "@chainlink/contracts-ccip/contracts/libraries/RateLimiter.sol";
import {ITokenAdminRegistry} from "@chainlink/contracts-ccip/contracts/interfaces/ITokenAdminRegistry.sol";
import {AuthorizedCallers} from "@chainlink/contracts/src/v0.8/shared/access/AuthorizedCallers.sol";

interface IRegistryModuleOwnerCustom {
    function registerAdminViaOwner(address token) external;
}

/**
 * @title Aktionariat Factory
 * @author Murat Ögat, murat@aktionariat.com
 *
 * Deploys a company's contracts on the home chain (Shares, SharesUnderAgreement with its CCIP lockbox and
 * lock-release pool, optional DirectInvestment and SecondaryMarket) and, on request, the bridged wrapper with
 * its burn-mint pool on other chains. Our contracts are created with CREATE3, so their addresses depend only
 * on this factory's address and the ticker. The factory itself is deployed at the same address on every
 * chain, which gives the wrapper and its bridged twin the same address everywhere. Chainlink's pools and the
 * lockbox record msg.sender as owner and are therefore created with CREATE2.
 *
 * The bytecodes live in separate stores that the owner can replace per chain. The factory owns the tokens
 * for the duration of the deployment, applies the allowlist regime, registers the pool with CCIP, and hands
 * the tokens to the issuer's multisig. Pool and lockbox ownership are offered to the issuer (two-step on
 * Chainlink's side); the factory stays the token's CCIP administrator.
 */
contract AktionariatFactory is Ownable {

    uint8 public constant VERSION = 1;
    uint256 public constant HOME_CHAIN_ID = 1;

    // Base token salt = keccak(ticker); the others append a suffix. The wrapper suffix is shared with the bridged
    // token. DirectInvestment, market and pool also append the version their store reports, so an upgrade gets
    // a new address while a redeployment of the same version is refused. The lockbox is permanent.
    bytes32 public constant SALT_SUFFIX_SHA = keccak256("SHA");
    bytes32 public constant SALT_SUFFIX_DIRECT_INVESTMENT = keccak256("DirectInvestment");
    bytes32 public constant SALT_SUFFIX_SECONDARY_MARKET = keccak256("SecondaryMarket");
    bytes32 public constant SALT_SUFFIX_TOKEN_POOL = keccak256("TokenPool");
    bytes32 public constant SALT_SUFFIX_LOCK_BOX = keccak256("LockBox");

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
        address pool;
        address lockBox;
        address directInvestment;
        address market;
    }

    // The home-chain side of a bridge, given when deploying the bridged token on another chain.
    struct RemoteChain {
        uint64 chainSelector;
        address pool;
    }

    struct Chainlink {
        address router;
        address rmnProxy;
        address tokenAdminRegistry;
        address registryModule;   // RegistryModuleOwnerCustom
    }

    struct Versions {
        uint256 factory;
        uint256 shares;
        uint256 sharesUnderAgreement;
        uint256 bridgedSharesUnderAgreement;
        uint256 directInvestment;
        uint256 secondaryMarket;
        uint256 lockReleaseTokenPool;
        uint256 burnMintTokenPool;
    }

    BytecodeStore public sharesFactory;
    BytecodeStore public sharesUnderAgreementFactory;
    BytecodeStore public bridgedSharesUnderAgreementFactory;
    BytecodeStore public directInvestmentFactory;
    BytecodeStore public secondaryMarketFactory;
    BytecodeStore public lockReleaseTokenPoolFactory;
    BytecodeStore public burnMintTokenPoolFactory;

    address public paymentHub;
    address public router;
    address public currency;
    Chainlink public chainlink;

    event CompanyDeployed(string ticker, address indexed owner, address base, address wrapper);
    event BridgeDeployed(address indexed token, address pool, address lockBox);
    event DirectInvestmentDeployed(address indexed token, address directInvestment);
    event SecondaryMarketDeployed(address indexed token, address market);
    event BridgedTokenDeployed(string ticker, address indexed owner, address token, address pool);
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
        c.directInvestment = _deployDirectInvestment(p.ticker, c.wrapper, p.owner, d, p.restricted);
        _handOver(c, p.owner);
    }

    function deployCompanyWithDirectInvestmentAndSecondaryMarket(CompanyParams calldata p, DirectInvestmentParams calldata d) external onlyOwner returns (Company memory c) {
        c = _deployTokens(p);
        c.directInvestment = _deployDirectInvestment(p.ticker, c.wrapper, p.owner, d, p.restricted);
        c.market = _deploySecondaryMarket(p.ticker, c.wrapper, p.owner, p.restricted);
        _handOver(c, p.owner);
    }

    // Later additions or upgrades of an existing company. The factory no longer owns the wrapper, so under a
    // restricted regime the issuer types the new contract ALLOWED afterwards.

    function addDirectInvestment(string calldata ticker, DirectInvestmentParams calldata d) external onlyOwner returns (address) {
        address wrapper = _wrapperAddress(ticker);
        return _deployDirectInvestment(ticker, wrapper, Ownable(wrapper).owner(), d, false);
    }

    function addSecondaryMarket(string calldata ticker) external onlyOwner returns (address) {
        address wrapper = _wrapperAddress(ticker);
        return _deploySecondaryMarket(ticker, wrapper, Ownable(wrapper).owner(), false);
    }

    // Deployment, other chains: the bridged wrapper lands on the home-chain wrapper's address, with its burn-mint
    // pool pointed at the home chain. Called only when the issuer enables the chain.

    function deployBridgedToken(string calldata ticker, string calldata symbol, string calldata name, string calldata terms, bool restricted, address owner_, RemoteChain calldata home) external onlyOwner returns (address token, address pool) {
        if (block.chainid == HOME_CHAIN_ID) revert HomeChain();
        if (owner_ == address(0)) revert OwnerRequired();
        token = Create3.deploy(_salt(ticker, SALT_SUFFIX_SHA), _initCode(bridgedSharesUnderAgreementFactory, "bridgedSharesUnderAgreementFactory", abi.encode(symbol, name, terms, address(this))));
        pool = Create2.deploy(_poolSalt(ticker, burnMintTokenPoolFactory), _burnMintPoolInitCode(token));
        BridgedSharesUnderAgreement(token).setPool(pool);
        _addRemoteChain(pool, token, home);
        _register(token, pool);
        if (restricted) {
            ERC20Allowlistable(token).setApplicable(true);
            _allow(token, pool);
        }
        Ownable(token).transferOwnership(owner_);
        TokenPool(pool).transferOwnership(owner_);
        emit BridgedTokenDeployed(ticker, owner_, token, pool);
    }

    // Prediction, a function of the ticker and, where a store version is part of the salt, of the stores set

    function predictCompany(string calldata ticker) external view returns (Company memory c) {
        c.base = Create3.predict(_salt(ticker));
        c.wrapper = _wrapperAddress(ticker);
        c.lockBox = Create2.predict(_salt(ticker, SALT_SUFFIX_LOCK_BOX), _lockBoxInitCode(c.wrapper));
        if (address(lockReleaseTokenPoolFactory) != address(0)) {
            c.pool = Create2.predict(_poolSalt(ticker, lockReleaseTokenPoolFactory), _lockReleasePoolInitCode(c.wrapper, c.lockBox));
        }
        c.directInvestment = predictDirectInvestment(ticker, _version(directInvestmentFactory));
        c.market = predictSecondaryMarket(ticker, _version(secondaryMarketFactory));
    }

    function predictDirectInvestment(string calldata ticker, uint256 version) public view returns (address) {
        return Create3.predict(_salt(ticker, SALT_SUFFIX_DIRECT_INVESTMENT, version));
    }

    function predictSecondaryMarket(string calldata ticker, uint256 version) public view returns (address) {
        return Create3.predict(_salt(ticker, SALT_SUFFIX_SECONDARY_MARKET, version));
    }

    function predictBridgedPool(string calldata ticker) external view returns (address) {
        return Create2.predict(_poolSalt(ticker, burnMintTokenPoolFactory), _burnMintPoolInitCode(_wrapperAddress(ticker)));
    }

    // CCIP administration: the factory stays the registered administrator of every token it deploys.

    function setRegisteredPool(address token, address pool) external onlyOwner {
        ITokenAdminRegistry(chainlink.tokenAdminRegistry).setPool(token, pool);
    }

    // Settings, per chain

    function setSharesFactory(BytecodeStore store) external onlyOwner { sharesFactory = store; emit SettingChanged("sharesFactory", address(store)); }
    function setSharesUnderAgreementFactory(BytecodeStore store) external onlyOwner { sharesUnderAgreementFactory = store; emit SettingChanged("sharesUnderAgreementFactory", address(store)); }
    function setBridgedSharesUnderAgreementFactory(BytecodeStore store) external onlyOwner { bridgedSharesUnderAgreementFactory = store; emit SettingChanged("bridgedSharesUnderAgreementFactory", address(store)); }
    function setDirectInvestmentFactory(BytecodeStore store) external onlyOwner { directInvestmentFactory = store; emit SettingChanged("directInvestmentFactory", address(store)); }
    function setSecondaryMarketFactory(BytecodeStore store) external onlyOwner { secondaryMarketFactory = store; emit SettingChanged("secondaryMarketFactory", address(store)); }
    function setLockReleaseTokenPoolFactory(BytecodeStore store) external onlyOwner { lockReleaseTokenPoolFactory = store; emit SettingChanged("lockReleaseTokenPoolFactory", address(store)); }
    function setBurnMintTokenPoolFactory(BytecodeStore store) external onlyOwner { burnMintTokenPoolFactory = store; emit SettingChanged("burnMintTokenPoolFactory", address(store)); }
    function setPaymentHub(address hub) external onlyOwner { paymentHub = hub; emit SettingChanged("paymentHub", hub); }
    function setRouter(address router_) external onlyOwner { router = router_; emit SettingChanged("router", router_); }
    function setCurrency(address currency_) external onlyOwner { currency = currency_; emit SettingChanged("currency", currency_); }

    function setChainlink(Chainlink calldata c) external onlyOwner {
        chainlink = c;
        emit SettingChanged("chainlink.router", c.router);
        emit SettingChanged("chainlink.rmnProxy", c.rmnProxy);
        emit SettingChanged("chainlink.tokenAdminRegistry", c.tokenAdminRegistry);
        emit SettingChanged("chainlink.registryModule", c.registryModule);
    }

    function versions() external view returns (Versions memory v) {
        v.factory = VERSION;
        v.shares = _version(sharesFactory);
        v.sharesUnderAgreement = _version(sharesUnderAgreementFactory);
        v.bridgedSharesUnderAgreement = _version(bridgedSharesUnderAgreementFactory);
        v.directInvestment = _version(directInvestmentFactory);
        v.secondaryMarket = _version(secondaryMarketFactory);
        v.lockReleaseTokenPool = _version(lockReleaseTokenPoolFactory);
        v.burnMintTokenPool = _version(burnMintTokenPoolFactory);
    }

    // Internals

    function _deployTokens(CompanyParams calldata p) private returns (Company memory c) {
        if (block.chainid != HOME_CHAIN_ID) revert NotHomeChain();
        if (p.owner == address(0)) revert OwnerRequired();
        c.base = Create3.deploy(_salt(p.ticker), _initCode(sharesFactory, "sharesFactory", abi.encode(p.ticker, p.name, p.terms, address(this))));
        c.wrapper = Create3.deploy(_salt(p.ticker, SALT_SUFFIX_SHA), _initCode(sharesUnderAgreementFactory, "sharesUnderAgreementFactory", abi.encode(c.base, p.wrapperTerms, address(this))));
        emit CompanyDeployed(p.ticker, p.owner, c.base, c.wrapper);
        (c.pool, c.lockBox) = _deployHomeBridge(p.ticker, c.wrapper);
        if (p.restricted) {
            ERC20Allowlistable(c.base).setApplicable(true);
            ERC20Allowlistable(c.wrapper).setApplicable(true);
            // The wrapper pays base tokens back to its own holders after termination; they all passed its gate.
            ERC20Allowlistable(c.base).setType(c.wrapper, ERC20Allowlistable(c.base).TYPE_ADMIN());
            _allow(c.wrapper, c.pool);
            _allow(c.wrapper, c.lockBox);
        }
    }

    // Lockbox and lock-release pool for the wrapper, owned by the factory until the issuer accepts. No remote
    // chain is configured; the pool owner adds chains as the issuer enables them.
    function _deployHomeBridge(string calldata ticker, address wrapper) private returns (address pool, address lockBox) {
        lockBox = Create2.deploy(_salt(ticker, SALT_SUFFIX_LOCK_BOX), _lockBoxInitCode(wrapper));
        pool = Create2.deploy(_poolSalt(ticker, lockReleaseTokenPoolFactory), _lockReleasePoolInitCode(wrapper, lockBox));
        address[] memory callers = new address[](1);
        callers[0] = pool;
        ERC20LockBox(lockBox).applyAuthorizedCallerUpdates(AuthorizedCallers.AuthorizedCallerArgs({addedCallers: callers, removedCallers: new address[](0)}));
        _register(wrapper, pool);
        emit BridgeDeployed(wrapper, pool, lockBox);
    }

    function _deployDirectInvestment(string calldata ticker, address wrapper, address owner_, DirectInvestmentParams calldata d, bool restricted) private returns (address di) {
        di = Create3.deploy(_salt(ticker, SALT_SUFFIX_DIRECT_INVESTMENT, _version(directInvestmentFactory)), _initCode(directInvestmentFactory, "directInvestmentFactory", abi.encode(wrapper, d.price, d.increment, currency, owner_, paymentHub)));
        if (restricted) _allow(wrapper, di);
        emit DirectInvestmentDeployed(wrapper, di);
    }

    function _deploySecondaryMarket(string calldata ticker, address wrapper, address owner_, bool restricted) private returns (address market) {
        market = Create3.deploy(_salt(ticker, SALT_SUFFIX_SECONDARY_MARKET, _version(secondaryMarketFactory)), _initCode(secondaryMarketFactory, "secondaryMarketFactory", abi.encode(owner_, currency, wrapper, router)));
        if (restricted) _allow(wrapper, market);
        emit SecondaryMarketDeployed(wrapper, market);
    }

    // Registers the factory as CCIP administrator of the token (it owns the token at this point) and maps the pool.
    function _register(address token, address pool) private {
        IRegistryModuleOwnerCustom(chainlink.registryModule).registerAdminViaOwner(token);
        ITokenAdminRegistry registry = ITokenAdminRegistry(chainlink.tokenAdminRegistry);
        registry.acceptAdminRole(token);
        registry.setPool(token, pool);
    }

    // Points a pool at the remote chain's pool and token (the token shares its address); rate limits off.
    function _addRemoteChain(address pool, address token, RemoteChain calldata remote) private {
        bytes[] memory remotePools = new bytes[](1);
        remotePools[0] = abi.encode(remote.pool);
        TokenPool.ChainUpdate[] memory adds = new TokenPool.ChainUpdate[](1);
        adds[0] = TokenPool.ChainUpdate({
            remoteChainSelector: remote.chainSelector,
            remotePoolAddresses: remotePools,
            remoteTokenAddress: abi.encode(token),
            outboundRateLimiterConfig: RateLimiter.Config({isEnabled: false, capacity: 0, rate: 0}),
            inboundRateLimiterConfig: RateLimiter.Config({isEnabled: false, capacity: 0, rate: 0})
        });
        TokenPool(pool).applyChainUpdates(new uint64[](0), adds);
    }

    // Intermediaries facing outside addresses are ALLOWED, not ADMIN: they may only pay out to holders the issuer typed.
    function _allow(address token, address intermediary) private {
        ERC20Allowlistable(token).setType(intermediary, ERC20Allowlistable(token).TYPE_ALLOWED());
    }

    function _handOver(Company memory c, address owner_) private {
        Ownable(c.base).transferOwnership(owner_);
        Ownable(c.wrapper).transferOwnership(owner_);
        TokenPool(c.pool).transferOwnership(owner_);
        ERC20LockBox(c.lockBox).transferOwnership(owner_);
    }

    function _lockBoxInitCode(address token) private pure returns (bytes memory) {
        return abi.encodePacked(type(ERC20LockBox).creationCode, abi.encode(token));
    }

    function _lockReleasePoolInitCode(address token, address lockBox) private view returns (bytes memory) {
        return _initCode(lockReleaseTokenPoolFactory, "lockReleaseTokenPoolFactory", abi.encode(token, uint8(0), address(0), chainlink.rmnProxy, chainlink.router, lockBox));
    }

    function _burnMintPoolInitCode(address token) private view returns (bytes memory) {
        return _initCode(burnMintTokenPoolFactory, "burnMintTokenPoolFactory", abi.encode(token, uint8(0), address(0), chainlink.rmnProxy, chainlink.router));
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

    function _poolSalt(string calldata ticker, BytecodeStore store) private pure returns (bytes32) {
        return _salt(ticker, SALT_SUFFIX_TOKEN_POOL, _version(store));
    }

    function _salt(string calldata ticker) private pure returns (bytes32) {
        return keccak256(bytes(ticker));
    }

    function _salt(string calldata ticker, bytes32 suffix) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(ticker, suffix));
    }

    function _salt(string calldata ticker, bytes32 suffix, uint256 version) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(ticker, suffix, version));
    }
}
