/**
 * SPDX-License-Identifier: LicenseRef-Aktionariat
 *
 * MIT License with Automated License Fee Payments
 *
 * Copyright (c) 2025 Aktionariat AG (aktionariat.com)
 *
 * Permission is hereby granted, any person obtaining a copy of this software
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
pragma solidity ^0.8.26;

import {TokenPoolFactory} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/TokenPoolFactory/TokenPoolFactory.sol";
import {BurnMintTokenPool} from "@chainlink/contracts-ccip/contracts/pools/BurnMintTokenPool.sol";

import {ChainlinkService} from "../lib/ChainlinkService.sol";
import {CCIPTokenPoolFactory} from "../base/CCIPTokenPoolFactory.sol";

import {BridgedSharesUnderAgreement} from "../../multichain/BridgedSharesUnderAgreement.sol";

contract CCIPBurnMintTokenPoolFactory is CCIPTokenPoolFactory {
    constructor(
        ChainlinkService.ChainlinkAddresses memory initialChainlinkAddresses
    ) CCIPTokenPoolFactory(initialChainlinkAddresses) {}

    function _targetBytecode() internal pure override returns (bytes memory) {
        return type(BurnMintTokenPool).creationCode;
    }

    function _poolType() internal pure override returns (TokenPoolFactory.PoolType) {
        return TokenPoolFactory.PoolType.BURN_MINT;
    }

    function _encodePoolConstructorArgs(address token, uint8 decimals) internal view override returns (bytes memory) {
        return abi.encode(token, decimals, new uint64[](0), chainlinkAddresses.rmnProxy, chainlinkAddresses.router);
    }

    /**
     * @notice Authorize the pool as minter/burner on the bridged token.
     */
    function _postTokenPrePoolDeploy(address pool, address localToken) internal override {
        BridgedSharesUnderAgreement(localToken).setPool(pool);
    }
}
