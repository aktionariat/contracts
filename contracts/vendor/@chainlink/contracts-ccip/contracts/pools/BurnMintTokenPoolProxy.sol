// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import {ITypeAndVersion} from "@chainlink/contracts/src/v0.8/shared/interfaces/ITypeAndVersion.sol";
import {IBurnMintERC20} from "@chainlink/contracts/src/v0.8/shared/token/ERC20/IBurnMintERC20.sol";

import {BurnMintTokenPoolAbstract} from "./BurnMintTokenPoolAbstract.sol";
import {TokenPoolProxy} from "./TokenPoolProxy.sol";

/// @notice This pool mints and burns a 3rd-party token.
/// @dev Pool whitelisting mode is set in the constructor and cannot be modified later.
/// It either accepts any address as originalSender, or only accepts whitelisted originalSender.
/// The only way to change whitelisting mode is to deploy a new pool.
/// If that is expected, please make sure the token's burner/minter roles are adjustable.
/// @dev This contract is a variant of BurnMintTokenPool that uses `burn(amount)`.
contract BurnMintTokenPoolProxy is BurnMintTokenPoolAbstract, ITypeAndVersion {
    string public constant override typeAndVersion = "BurnMintTokenPool 1.5.1";

    constructor(IBurnMintERC20 token, uint8 localTokenDecimals, address[] memory allowlist, address rmnProxy, address router) TokenPoolProxy(token, localTokenDecimals, allowlist, rmnProxy, router) {}

    /// @inheritdoc BurnMintTokenPoolAbstract
    function _burn(uint256 amount) internal virtual override {
        IBurnMintERC20(address(i_token)).burn(amount);
    }

    /**
     * Proxy constructor
     * @dev No modifications applied from BurnMintTokenPool constructor
     *
     * @param token the local token
     * @param localTokenDecimals the local token decimals
     * @param allowlist the allowlist to add to the TokenPool
     * @param rmnProxy the local rmnProxy address
     * @param router the local router address
     */
    function initialize(IBurnMintERC20 token, uint8 localTokenDecimals, address[] memory allowlist, address rmnProxy, address router) public initializer {
        __TokenPoolProxy_init(token, localTokenDecimals, allowlist, rmnProxy, router);
    }
}
