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

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {TokenPoolFactory} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/TokenPoolFactory/TokenPoolFactory.sol";

import {Deployment} from "../lib/Deployment.sol";
import {ChainlinkService} from "../lib/ChainlinkService.sol";

import {BridgedSharesUnderAgreement} from "../../multichain/BridgedSharesUnderAgreement.sol";

contract CCIPBurnMintTokenPoolFactory is Ownable {
    bytes public bytecode;
    bytes32 public bytecodeHash;

    ChainlinkService.ChainlinkAddresses public chainlinkAddresses;

    event BytecodeUpdated(bytes32 indexed newHash);
    event ChainlinkAddressesUpdated(ChainlinkService.ChainlinkAddresses indexed newChainlinkAddresses);

    event PoolDeployed(address indexed pool, address indexed token);

    error EmptyBytecode();

    constructor(
        bytes memory initialBytecode,
        ChainlinkService.ChainlinkAddresses memory initialChainlinkAddresses
    ) Ownable(msg.sender) {
        // bytecode
        if (initialBytecode.length == 0) revert EmptyBytecode();
        bytecode = initialBytecode;
        bytecodeHash = keccak256(initialBytecode);

        // chainlink addresses
        ChainlinkService._validateChainlinkAddresses(initialChainlinkAddresses);
        chainlinkAddresses = initialChainlinkAddresses;
    }

    function setBytecode(bytes calldata newBytecode) external onlyOwner {
        if (newBytecode.length == 0) revert EmptyBytecode();
        bytecode = newBytecode;
        bytecodeHash = keccak256(newBytecode);
        emit BytecodeUpdated(bytecodeHash);
    }

    function setChainlinkAddresses(ChainlinkService.ChainlinkAddresses memory newChainlinkAddresses) external onlyOwner {
        ChainlinkService._validateChainlinkAddresses(newChainlinkAddresses);
        chainlinkAddresses = newChainlinkAddresses;
        emit ChainlinkAddressesUpdated(newChainlinkAddresses);
    }

    /**
     * @notice Predict the CREATE2 address as Chainlink's TokenPoolFactory would see it.
     * @dev    Applies the salt transformation: actualSalt = keccak256(abi.encodePacked(salt, address(this))).
     *         Matches the encoding used by TokenPoolFactory.deployTokenPoolWithExistingToken
     *         with PoolType.BURN_MINT.
     */
    function predict(
        bytes32 salt,
        address token,
        uint8 decimals
    ) external view returns (address) {
        // chainlink factories mixes salt with msg.sender
        bytes32 actualSalt = keccak256(abi.encodePacked(salt, address(this)));
        return Deployment.compute(
            bytecode,
            chainlinkAddresses.tokenPoolFactory,
            actualSalt,
            // token may not be yet deployed
            abi.encode(token, decimals, new uint64[](0), chainlinkAddresses.rmnProxy, chainlinkAddresses.router)
        );
    }

    /**
     * @notice Deploy a BurnMintTokenPool through Chainlink's TokenPoolFactory and
     *         configure the full CCIP infrastructure.
     * @dev    Follows the same flow as FactoryDestination.deployTokenBridge:
     *         1. Deploy pool via TokenPoolFactory.deployTokenPoolWithExistingToken
     *         2. Call setPool on the bridged token to authorize the pool
     *         3. Apply CCIP infrastructure settings via CCIPService
     *         The bridged token must already be owned by this contract.
     */
    function deploy(
        bytes32 salt,
        address localToken,
        TokenPoolFactory.RemoteTokenPoolInfo[] calldata remoteTokenPools,
        address futureOwner
    ) external onlyOwner returns (address deployedPool) {
        // we need to be able to set settings and the pool
        Deployment._isContractOwner(localToken, address(this));
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        // deploy factory
        deployedPool = TokenPoolFactory(chainlinkAddresses.tokenPoolFactory).deployTokenPoolWithExistingToken(
            localToken,
            IERC20Metadata(localToken).decimals(),
            remoteTokenPools,
            bytecode,
            salt,
            TokenPoolFactory.PoolType.BURN_MINT
        );

        // Authorize pool as minter/burner on the bridged token
        BridgedSharesUnderAgreement(localToken).setPool(deployedPool);

        // apply settings
        ChainlinkService._applySettingToChainlinkCCIPInfrastructure(
            deployedPool,
            localToken,
            futureOwner,
            chainlinkAddresses.registryModuleOwner,
            chainlinkAddresses.tokenAdminRegistry
        );

        // give back ownership on local token
        Ownable(localToken).transferOwnership(futureOwner);

        emit PoolDeployed(deployedPool, localToken);
    }
}
