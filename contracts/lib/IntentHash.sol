// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.29;

import {IERC20} from "../ERC20/IERC20.sol";
import {PermitHash} from "./PermitHash.sol";

struct Intent {
	address owner;
	address filler;
	address tokenOut; // The ERC20 token sent out
	uint160 amountOut; // The maximum amount
	address tokenIn; // The ERC20 token received
	uint160 amountIn; // The amount received in exchange for the maximum of the sent token
	uint48 expiration; // timestamp at which the intent expires
	uint48 nonce; // a unique value indexed per owner,token,and spender for each signature
	bytes data;
}

/// @notice helpers for handling dutch order objects
library IntentHash {

	bytes internal constant INTENT_TYPE =
		abi.encodePacked(
			"Intent(",
			"address owner,",
			"address filler,",
			"address tokenOut,",
			"uint160 amountOut,",
			"address tokenIn,",
			"uint160 amountIn,",
			"uint48 expiration,",
			"uint48 nonce,",
			"bytes data)"
		);

	bytes32 internal constant INTENT_TYPE_HASH = keccak256(INTENT_TYPE);

	string internal constant PERMIT2_INTENT_TYPE =
        string(abi.encodePacked("Intent witness)", INTENT_TYPE, PermitHash._TOKEN_PERMISSIONS_TYPESTRING));

	/// @notice hash the given intent
	/// @param intent the intent to hash
	/// @return the eip-712 intent hash
	function hash(Intent calldata intent) internal pure returns (bytes32) {
		return
			keccak256(
				abi.encode(
					INTENT_TYPE_HASH,
					intent.owner,
					intent.filler,
					intent.tokenOut,
					intent.amountOut,
					intent.tokenIn,
					intent.amountIn,
					intent.expiration,
					intent.nonce,
					keccak256(intent.data)
				)
			);
	}
}
