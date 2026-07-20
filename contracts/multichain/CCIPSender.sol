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
pragma solidity ^0.8.24;

import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * Communication layer between CCIP Infrastructure and Aktionariat SharesUnderAgreement and BridgedSharesUnderAgreement
 *
 * By calling sendToken you build and send the CCIP CCT message to bridge tokens.
 */
contract CCIPSender {
    using SafeERC20 for IERC20;

    IRouterClient public immutable router;

    error NotEnoughNativeToken(uint256 fee, uint256 actualValue);
    error NativeRefundFailed(uint256 amount);
    error DoNotSendNativePayment();

    constructor(address _router) {
        router = IRouterClient(_router);
    }

    /**
     * Construct and broadcast a CCIP EVM2AnyMessage message to bridge tokens to a desired destination chain
     *
     * @param destinationChainSelector CCIP selector of destination chain
     * @param receiver destination receiver contract
     * @param token token to bridge
     * @param amount amount of token to be bridged
     *
     * @dev We could minimize on sanitization functionality and separate
     * ether and token payments in separate functions to cut on gas, since
     * token payment is probably rarely going to happen
     */
    function sendToken(uint64 destinationChainSelector, address receiver, address token, uint256 amount, address feeToken, bytes memory data) external payable returns (bytes32 messageId) {
        // approve token to be move by CCIPSender on behalf of owner (to CCIP infrastructure)
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // approve token to be moved by CCIP Router on behalf of CCIPSender (within CCIP infrastructure)
        // for USDT we should call forceApprove, sets balance to zero then to amount to be spent
        // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/db06a6ef998c4fde4ef3ff2c6fd6010aa0841d4f/contracts/token/ERC20/utils/SafeERC20.sol#L10
        IERC20(token).forceApprove(address(router), amount);

        // message and fees
        Client.EVM2AnyMessage memory message = _buildBridgeSharesMessage(receiver, token, amount, feeToken, data);
        uint256 fee = router.getFee(destinationChainSelector, message);

        if (address(0) == feeToken) {
            // Native token
            if (msg.value < fee) {
                revert NotEnoughNativeToken(fee, msg.value);
            }

            // send message
            messageId = router.ccipSend{value: fee}(destinationChainSelector, message);

            // send back unused fees
            uint256 refund = msg.value - fee;
            if (refund > 0) {
                (bool sent, ) = payable(msg.sender).call{value: refund}("");
                if (!sent) {
                    revert NativeRefundFailed(refund);
                }
            }
        } else {
            if (0 < msg.value) {
                revert DoNotSendNativePayment();
            }

            // IERC20 transfers and allowances
            IERC20(feeToken).safeTransferFrom(msg.sender, address(this), fee);
            IERC20(feeToken).forceApprove(address(router), fee);

            // send message, router is responsible for transfering the token fee
            messageId = router.ccipSend(destinationChainSelector, message);
        }
        return messageId;
    }

    // // View Functions // //

    /**
     * Utility to query fees before calling the sendToken function
     *
     * @param destinationChainSelector CCIP selector of destination chain
     * @param receiver destination receiver contract
     * @param token token to bridge
     * @param amount amount of token to be bridged
     * @param feeToken the token to pay the fee
     * @param data additional arbitrary CCIP call data
     *
     * @return fee the amount of fees to be paid to broadcast the message
     */
    function getEstimatedFee(uint64 destinationChainSelector, address receiver, address token, uint256 amount, address feeToken, bytes memory data) external view returns (uint256) {
        Client.EVM2AnyMessage memory message = _buildBridgeSharesMessage(receiver, token, amount, feeToken, data);
        return router.getFee(destinationChainSelector, message);
    }

    // // Interal Functions // //

    /**
     * Utility to build Chainlink CCIP EVM2AnyMessage struct
     *
     * @param receiver CCIP selector of destination chain
     * @param token token to bridge
     * @param amount amount of token to be bridged
     * @param feeToken token to pay the fee
     * @param data additional arbitrary CCIP call data
     *
     * @return EVM2AnyMessage struct
     */
    function _buildBridgeSharesMessage(address receiver, address token, uint256 amount, address feeToken, bytes memory data) internal pure returns (Client.EVM2AnyMessage memory) {
        return
            Client.EVM2AnyMessage({
                receiver: abi.encode(receiver),
                // token transfer information
                tokenAmounts: _buildTokenAmounts(token, amount),
                // arbitrary data
                data: data,
                // to fees in native gas token use address(0)
                feeToken: feeToken,
                extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: 0}))
            });
    }

    /**
     * Utility to build Chainlink CCIP EVMTokenAmount struct
     *
     * @param token token to bridge
     * @param amount amount of token to be bridged
     *
     * @return EVMTokenAmount struct
     */
    function _buildTokenAmounts(address token, uint256 amount) internal pure returns (Client.EVMTokenAmount[] memory) {
        Client.EVMTokenAmount[] memory tokens = new Client.EVMTokenAmount[](1);
        tokens[0] = Client.EVMTokenAmount({token: token, amount: amount});

        return tokens;
    }
}
