// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {AuthorizedCall, AuthorizedCallHash} from "./AuthorizedCall.sol";

contract AuthorizedCallVerifier {

    using AuthorizedCallHash for AuthorizedCall;
    
    error InvalidSignatureLength();
    error InvalidSignature();
    error InvalidSigner();

    // EIP-712 Domain Properties
    // Name: "AuthorizedCall"
    // Version: "1"
    // Chain ID: current chain id
    // Verifying Contract: this contract
    // Salt: hash of "aktionariat" as bytes32
    // 
    // IMPORTANT:
    // This can't be an instance variable. 
    // It remains uninitialized in the context of the EOA since the contract is not deployed   
    function getDomainSeparator() private view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"),
            keccak256(bytes("AuthorizedCall")),
            keccak256(bytes("1")),
            block.chainid,
            address(this),
            keccak256(bytes("aktionariat"))
        ));
    }

    function verifyAuthorizedCallSignature(AuthorizedCall calldata call, bytes calldata sig) public view {
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", getDomainSeparator(), call.hash()));
        (uint8 v, bytes32 r, bytes32 s) = signatureToVRS(sig);
        
        address recoveredAddress = ecrecover(digest, v, r, s);

        if (recoveredAddress == address(0)) revert InvalidSignature();
        if (recoveredAddress != address(this)) revert InvalidSigner();
    }

    function signatureToVRS(bytes memory signature) private pure returns (uint8 v, bytes32 r, bytes32 s) {
        if (signature.length == 65) {
            assembly {
                r := mload(add(signature, 32))
                s := mload(add(signature, 64))
                v := and(mload(add(signature, 65)), 255)
            }
            if (v < 27) v += 27;
        } else {
            revert InvalidSignatureLength();
        }
    }
}