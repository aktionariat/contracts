// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0 <0.9.0;

struct AuthorizedCall {
	uint256 nonce;
	address to;
	string functionSignature;
	uint256 value;
	bytes data;
}

library AuthorizedCallHash {
	bytes32 internal constant INTENT_TYPE_HASH = keccak256("AuthorizedCall(uint256 nonce,address to,string functionSignature,uint256 value,bytes data)");

	function hash(AuthorizedCall calldata call) internal pure returns (bytes32) {
		return
			keccak256(
				abi.encode(
					INTENT_TYPE_HASH,
					call.nonce,
					call.to,
					keccak256(bytes(call.functionSignature)),
					call.value,
					keccak256(call.data)
				)
			);
	}
}
