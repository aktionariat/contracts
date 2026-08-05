/**
 * SPDX-License-Identifier: LicenseRef-Aktionariat
 *
 * MIT License with Automated License Fee Payments
 *
 * Copyright (c) 2025 Aktionariat AG (aktionariat.com)
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

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {BurnMintTokenPool, IBurnMintERC20} from "@chainlink/contracts-ccip/contracts/pools/BurnMintTokenPool.sol";
import {IRouter} from "@chainlink/contracts-ccip/contracts/interfaces/IRouter.sol";

/**
 * We inherit BurnMintTokenPool to add Proxy initialization
 */
contract BurnMintTokenPoolAktionariat is Initializable, BurnMintTokenPool {
    constructor(
        IBurnMintERC20 token,
        uint8 localTokenDecimals,
        address[] memory allowlist,
        address rmnProxy,
        address router
    ) BurnMintTokenPool(token, localTokenDecimals, allowlist, rmnProxy, router) {}

    /**
     * No modifications applied from BurnMintTokenPool constructor
     *
     * @param token the local token
     * @param localTokenDecimals the local token decimals
     * @param allowlist the allowlist to add to the TokenPool
     * @param rmnProxy the local rmnProxy address
     * @param router the local router address
     */
    function initialize(IBurnMintERC20 token, uint8 localTokenDecimals, address[] memory allowlist, address rmnProxy, address router) public initializer {
        __TokenPool_init(token, localTokenDecimals, allowlist, rmnProxy, router);
    }

    // Define also inheritance related constructors
    /**
     * No modifications applied from TokenPool constructor
     *
     * @param token the local token
     * @param localTokenDecimals the local token decimals
     * @param allowlist the allowlist to add to the TokenPool
     * @param rmnProxy the local rmnProxy address
     * @param router the local router address
     */
    function __TokenPool_init(IBurnMintERC20 token, uint8 localTokenDecimals, address[] memory allowlist, address rmnProxy, address router) internal onlyInitializing {
        if (address(token) == address(0) || router == address(0) || rmnProxy == address(0)) revert ZeroAddressNotAllowed();
        i_token = token;
        i_rmnProxy = rmnProxy;

        try IERC20Metadata(address(token)).decimals() returns (uint8 actualTokenDecimals) {
            if (localTokenDecimals != actualTokenDecimals) {
                revert InvalidDecimalArgs(localTokenDecimals, actualTokenDecimals);
            }
        } catch {
            // The decimals function doesn't exist, which is possible since it's optional in the ERC20 spec. We skip the check and
            // assume the supplied token decimals are correct.
        }
        i_tokenDecimals = localTokenDecimals;

        s_router = IRouter(router);

        // Pool can be set as permissioned or permissionless at deployment time only to save hot-path gas.
        i_allowlistEnabled = allowlist.length > 0;
        if (i_allowlistEnabled) {
            _applyAllowListUpdates(new address[](0), allowlist);
        }
    }
}
