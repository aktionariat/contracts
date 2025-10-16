// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AuthorizedCall, AuthorizedCallHash} from "./AuthorizedCall.sol";
import {AuthorizedCallVerifier} from "./AuthorizedCallVerifier.sol";

contract AuthorizedExecutor layout at 971071161051111109711410597116 is AuthorizedCallVerifier {
    using AuthorizedCallHash for AuthorizedCall;
    
    /// @notice A nonce used for replay protection, stored in custom storage layout
    uint256 public nonce;

    event CallExecuted(address indexed sender, address indexed to, uint256 value, bytes data);

    error InvalidNonce();

    /**
     * @notice Executes a call using an off–chain signature.
     * @param call A Call struct containing destination, ETH value, and calldata.
     * @param signature The typed data signature over call, which also includes the nonce.
     */
    function execute(AuthorizedCall calldata call, bytes calldata signature) external payable {
        require(call.nonce == nonce, InvalidNonce());

        verifyAuthorizedCallSignature(call, signature);
        verifySponsoredCallFunction(call);

        _executeCall(call);
    }

    function verifySponsoredCallFunction(AuthorizedCall calldata call) internal {
        // TODO: Check the data starts with the function selector
        

    }

    /**
     * @dev Internal function to execute a single call.
     * @param call The Call struct containing destination, value, and calldata.
     */
    function _executeCall(AuthorizedCall calldata call) internal {
        nonce++;
        (bool success,) = call.to.call{value: call.value}(call.data);
        require(success, "Call reverted");
        emit CallExecuted(msg.sender, call.to, call.value, call.data);
    }

    fallback() external payable {}
    receive() external payable {}
}