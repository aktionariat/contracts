// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {Intent, IntentHash} from "./IntentHash.sol";

contract EIP712 {

    using IntentHash for Intent;
    
    error InvalidSignatureLength();
    error InvalidSignature();
    error InvalidSigner();

    string private EIP712DomainName = "TradeIntent";
    string private EIP712DomainVersion = "1";
    uint256 private EIP712DomainChainId = block.chainid;
    address private EIP712DomainVerifyingContract = address(this);
    bytes32 private EIP712DomainSalt = "aktionariat";

    bytes32 private DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"),
            keccak256(bytes(EIP712DomainName)),
            keccak256(bytes(EIP712DomainVersion)),
            EIP712DomainChainId,
            EIP712DomainVerifyingContract,
            EIP712DomainSalt
    ));

    function verifyIntentSignature(Intent calldata intent, bytes calldata sig) public view {
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            intent.hash()
        ));

        (uint8 v, bytes32 r, bytes32 s) = signatureToVRS(sig);
        address recoveredAddress = ecrecover(digest, v, r, s);

        if (recoveredAddress == address(0)) revert InvalidSignature();
        if (recoveredAddress != intent.owner) revert InvalidSigner();
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