// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract SponsoredCall layout at 971071161051111109711410597116 {
    using ECDSA for bytes32;
    
    /// @notice The raw call to be executed
    struct Call {
        address to;
        uint256 value;
        bytes data;
    }

    /// @notice A nonce used for replay protection, stored in custom storage layout
    uint256 public nonce;

    event CallExecuted(address indexed sender, address indexed to, uint256 value, bytes data);

    /**
     * @notice Executes a call using an off–chain signature.
     * @param call A Call struct containing destination, ETH value, and calldata.
     * @param signature The ECDSA signature over the current nonce and the call data.
     */
    function execute(Call calldata call, bytes calldata signature) external payable {
        bytes memory encodedCall = abi.encodePacked(nonce, call.to, call.value, call.data);
        bytes32 digest = keccak256(encodedCall);
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(digest);

        // Recover the signer from the provided signature.
        address recovered = ECDSA.recover(ethSignedMessageHash, signature);
        require(recovered == address(this), "Invalid signature");

        _executeCall(call);
    }

    /**
     * @dev Internal function to execute a single call.
     * @param callItem The Call struct containing destination, value, and calldata.
     */
    function _executeCall(Call calldata callItem) internal {
        nonce++;
        (bool success,) = callItem.to.call{value: callItem.value}(callItem.data);
        require(success, "Call reverted");
        emit CallExecuted(msg.sender, callItem.to, callItem.value, callItem.data);
    }

    // Allow the contract to receive ETH (e.g. from DEX swaps or other transfers).
    fallback() external payable {}
    receive() external payable {}
}