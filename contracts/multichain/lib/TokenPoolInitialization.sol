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

import {BurnMintTokenPoolAktionariat, IBurnMintERC20} from "../pool/BurnMintTokenPoolAktionariat.sol";
import {LockReleaseTokenPoolAktionariat, IERC20} from "../pool/LockReleaseTokenPoolAktionariat.sol";

// Two custom TokenPools initializations
library TokenPoolInitialization {
    error MissingRemoteTokenAddress();
    error MissingRemoteTokenPoolAddress();

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
        bytes memory tokenPoolInitArgs;
        if (localPoolType == TokenPoolFactory.PoolType.BURN_MINT) {
            BurnMintTokenPoolAktionariat(tokenPool).initialize(IBurnMintERC20(localToken), localTokenDecimals, new address[](0), i_rmnProxy, i_ccipRouter);
        } else if (localPoolType == TokenPoolFactory.PoolType.LOCK_RELEASE) {
            LockReleaseTokenPoolAktionariat(tokenPool).initialize(
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
     * @param poolAddress the token pool address it is deployed to
     * @param remoteTokenPools the RemoteTokenPoolInfo configurations
     * @param proposedPoolOwner the proposed owner of the pool
     */
    function _applyChainUpdatesTokenPool(address poolAddress, TokenPoolFactory.RemoteTokenPoolInfo[] calldata remoteTokenPools, address proposedPoolOwner) internal {
        // Create an array of chain updates to apply to the token pool
        TokenPool.ChainUpdate[] memory chainUpdates = new TokenPool.ChainUpdate[](remoteTokenPools.length);

        TokenPoolFactory.RemoteTokenPoolInfo memory remoteTokenPool;
        for (uint256 i = 0; i < remoteTokenPools.length; ++i) {
            remoteTokenPool = remoteTokenPools[i];

            // If the user provides an empty byte string, indicated no token has already been deployed,
            // then the address of the token needs to be predicted. Otherwise the address provided will be used.
            if (remoteTokenPool.remoteTokenAddress.length == 0) {
                revert MissingRemoteTokenAddress();
            }

            // If the user provides an empty byte string parameter, indicating the pool has not been deployed yet,
            // the address of the pool should be predicted. Otherwise use the provided address.
            if (remoteTokenPool.remotePoolAddress.length == 0) {
                revert MissingRemoteTokenPoolAddress();
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

        // Begin the 2 step ownership transfer of the proposed owner
        Ownable(poolAddress).transferOwnership(proposedPoolOwner); // 2 step ownership transfer
        // it will have to IOwnable(poolAddress).acceptOwnerhip()
    }
}
