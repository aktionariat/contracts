// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {IERC20} from "../ERC20/IERC20.sol";

/**
 * @title Intent
 * @author Luzius Meisser, luzius@aktionariat.com
 * @author Murat Ögat, murat@aktionariat.com
 *
 * The struct to be signed for submitting orders to the TradeReactor contract and its hashing per EIP-712.
 */

struct Intent {
	address owner;
	address filler;
	address tokenOut; // The ERC20 token sent out
	uint160 amountOut; // The maximum amount
	address tokenIn; // The ERC20 token received
	uint160 amountIn; // The amount received in exchange for the maximum of the sent token
	uint256 creation; // timestamp at which the intent was created
	uint256 expiration; // timestamp at which the intent expires
	bytes data;
}

/// @notice helpers for handling dutch order objects
library IntentHash {
	bytes32 internal constant INTENT_TYPE_HASH = keccak256("Intent(address owner,address filler,address tokenOut,uint160 amountOut,address tokenIn,uint160 amountIn,uint256 creation,uint256 expiration,bytes data)");

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
					intent.creation,
					intent.expiration,
					keccak256(intent.data)
				)
			);
	}
}
