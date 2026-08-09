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

import "@openzeppelin/contracts/proxy/Clones.sol";

import {Ownable} from "../../utils/Ownable.sol";
import {TokenPoolFactory} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/TokenPoolFactory/TokenPoolFactory.sol";
import {TokenPool} from "@chainlink/contracts-ccip/contracts/pools/TokenPool.sol";

import {BurnMintTokenPoolProxy, IBurnMintERC20} from "../../vendor/@chainlink/contracts-ccip/contracts/pools/BurnMintTokenPoolProxy.sol";
import {LockReleaseTokenPoolProxy, IERC20} from "../../vendor/@chainlink/contracts-ccip/contracts/pools/LockReleaseTokenPoolProxy.sol";

/**
 * Two custom TokenPools initializations
 * It is meant to replace the TokenPoolFactoryInitialization since by proxies we need
 * to initialize pools after the deployment through the `.initialize` function.
 *
 * @dev note that if you want to predict addresses within the code, `bytes remoteTokenInitCode`
 *      and `bytes remotePoolInitCode` differs from the standard initialization code
 *      plus constructor parameters. Indeed, they must hold the address of the
 *      implementation contracts, the token contract and the token pool respectively.
 */
library TokenPoolInitialization {
    error BytesNotAddressSize(bytes data);

    /**
     * It deploys the Token Pool logic via Proxy and initializes it.
     * Assumes the Token Pool defines the custon initialize proxy function.
     *
     * @param tokenPoolImplementation the token pool logic contract to be proxied
     * @param localToken the local token, which bridging is to be enabled
     * @param localTokenDecimals decimals of the token
     * @param localPoolType the type of the local token pool
     * @param i_rmnProxy the local RMN Proxy address
     * @param i_ccipRouter the local router contract address
     * @return tokenPool of the token pool
     */
    function _deployProxyTokenPool(
        address tokenPoolImplementation,
        address localToken,
        uint8 localTokenDecimals,
        TokenPoolFactory.PoolType localPoolType,
        address i_rmnProxy,
        address i_ccipRouter,
        bytes32 salt
    ) internal returns (address tokenPool) {
        // deploy proxy
        tokenPool = Clones.cloneDeterministic(tokenPoolImplementation, salt);

        // Initialize: TokenPool dependent
        if (localPoolType == TokenPoolFactory.PoolType.BURN_MINT) {
            BurnMintTokenPoolProxy(tokenPool).initialize(IBurnMintERC20(localToken), localTokenDecimals, new address[](0), i_rmnProxy, i_ccipRouter);
        } else if (localPoolType == TokenPoolFactory.PoolType.LOCK_RELEASE) {
            LockReleaseTokenPoolProxy(tokenPool).initialize(
                IERC20(localToken),
                localTokenDecimals,
                new address[](0),
                i_rmnProxy,
                true, // could also be made parameter
                i_ccipRouter
            );
        }
    }

    /**
     * Slightly modified _createTokenPool of Chainlink TokenPoolFactory.
     * We modify it so that we can use proxy also for TokenPool.
     *
     * It does nothing related to a specific type of pool.
     * Based on RemoteTokenPoolInfo it computes values for the remote token and remote token pool.
     * Which should be added directly to the local TokenPool for CCT message broadcasting.
     * Since we use proxies in both source and destination, the computation does not make sense in our case.
     * As such we discard the computation and introduce a firm check that all remote addresses have been passed.
     * Then we apply standard settings to the pool, independently from which pool it is.
     *
     * @dev note that if you want to predict addresses within the code, `bytes remoteTokenInitCode`
     *      and `bytes remotePoolInitCode` differs from the standard initialization code
     *      plus constructor parameters. Indeed, they must hold the address of the
     *      implementation contracts, the token contract and the token pool, respectively.
     * @param poolAddress the token pool address it is deployed to
     * @param remoteTokenPools the RemoteTokenPoolInfo configurations
     * @param salt the destination chain deployment salt
     */
    function _applyChainUpdatesTokenPool(address poolAddress, TokenPoolFactory.RemoteTokenPoolInfo[] calldata remoteTokenPools, bytes32 salt) internal {
        // Create an array of chain updates to apply to the token pool
        TokenPool.ChainUpdate[] memory chainUpdates = new TokenPool.ChainUpdate[](remoteTokenPools.length);

        TokenPoolFactory.RemoteTokenPoolInfo memory remoteTokenPool;
        for (uint256 i = 0; i < remoteTokenPools.length; ++i) {
            remoteTokenPool = remoteTokenPools[i];

            // If the user provides an empty byte string, indicated no token has already been deployed,
            // then the address of the token needs to be predicted. Otherwise the address provided will be used.
            if (remoteTokenPool.remoteTokenAddress.length == 0) {
                remoteTokenPool.remoteTokenAddress = abi.encode(_predictDeterministicAddress(remoteTokenPool.remoteTokenInitCode, salt, remoteTokenPool.remoteChainConfig.remotePoolFactory));
            }

            // If the user provides an empty byte string parameter, indicating the pool has not been deployed yet,
            // the address of the pool should be predicted. Otherwise use the provided address.
            if (remoteTokenPool.remotePoolAddress.length == 0) {
                remoteTokenPool.remotePoolAddress = abi.encode(_predictDeterministicAddress(remoteTokenPool.remotePoolInitCode, salt, remoteTokenPool.remoteChainConfig.remotePoolFactory));
            }

            bytes[] memory remotePoolAddresses = new bytes[](1);
            remotePoolAddresses[0] = remoteTokenPool.remotePoolAddress;

            chainUpdates[i] = TokenPool.ChainUpdate({
                remoteChainSelector: remoteTokenPool.remoteChainSelector,
                remotePoolAddresses: remotePoolAddresses,
                remoteTokenAddress: remoteTokenPool.remoteTokenAddress,
                outboundRateLimiterConfig: remoteTokenPool.rateLimiterConfig,
                inboundRateLimiterConfig: remoteTokenPool.rateLimiterConfig
            });
        }

        // Apply the chain updates to the token pool
        TokenPool(poolAddress).applyChainUpdates(new uint64[](0), chainUpdates);

        // Here we don't need transferOwnership, since we are not passing throught the
        // chainlink's factory deployment. We can directly move to set up the pool.
        // See lib/FactoryCCIP.sol
    }

    /**
     * Ensures that the data is actually of address size, then predicts the address of the
     * deterministic deployed proxy
     *
     * @param data the address data
     * @param salt the salt used for deployment
     * @param deployer the deployer address
     */
    function _predictDeterministicAddress(bytes memory data, bytes32 salt, address deployer) internal pure returns (address) {
        if (data.length != 20) revert BytesNotAddressSize(data);

        address implementation;
        assembly {
            // `add(data, 32)` skips the 32-byte length slot to reach the address data.
            // `mload(...)` loads the 32 bytes starting at that position.
            // `shr(96, ...)` shifts right by 96 bits (12 bytes) to align the 20-byte address.
            implementation := shr(96, mload(add(data, 32)))
        }

        return Clones.predictDeterministicAddress(implementation, salt, deployer);
    }
}
