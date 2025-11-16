// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {AuthorizedCall, AuthorizedCallHash} from "./AuthorizedCall.sol";
import {AuthorizedCallVerifier} from "./AuthorizedCallVerifier.sol";

/**
 * @title AuthorizedExecutor
 * @author Murat Ögat, murat@aktionariat.com
 *
 * A "Smart Account" contract, intended to be used for execution delegation per EIP-7702.
 * If an authorization to this contract is set, calls can be executed by passing a signature.
 * The expected signature is the signTypedData signature over the AuthorizedCall object.
 */

contract AuthorizedExecutor layout at 971071161051111109711410597116 is AuthorizedCallVerifier {
    using AuthorizedCallHash for AuthorizedCall;
    
    uint256 public contractNonce;

    event CallExecuted(address indexed sender, address indexed to, uint256 value, bytes data, uint256 nonce);

    error InvalidNonce();
    error FunctionSignatureMismatch();
    error CallReverted();

    /**
     * @notice Executes a call using an off–chain signature.
     * @param call A Call struct containing destination, ETH value, and calldata.
     * @param signature The typed data signature over call, which also includes the nonce.
     */
    function execute(AuthorizedCall calldata call, bytes calldata signature) external payable {
        require(call.nonce == contractNonce, InvalidNonce());
        verifyAuthorizedCallSignature(call, signature);
        verifyAuthorizedCallFunction(call);

        contractNonce++;

        _executeCall(call);
    }

    /**
     * @notice Compares the function signature the user has seen during signing against what will actually be executed.
     */
    function verifyAuthorizedCallFunction(AuthorizedCall calldata call) internal pure {
        bytes4 signedFunctionSignature = bytes4(keccak256(bytes(call.functionSignature)));
        require(signedFunctionSignature == bytes4(call.data), FunctionSignatureMismatch());
    }

    /**
     * @dev Internal function to execute a single call.
     * @param call The Call struct containing destination, value, and calldata.
     */
    function _executeCall(AuthorizedCall calldata call) internal {
        (bool success,) = call.to.call{value: call.value}(call.data);
        require(success, CallReverted());
        emit CallExecuted(msg.sender, call.to, call.value, call.data, call.nonce);
    }

    fallback() external payable {}
    receive() external payable {}
}