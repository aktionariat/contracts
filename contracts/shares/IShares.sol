// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "../ERC20/IERC20.sol";

interface IShares is IERC20 {

	/*//////////////////////////////////////////////////////////////
                            Custom errors
	//////////////////////////////////////////////////////////////*/
	/// Array lengths have to be equal. 
	/// @param targets Array length of targets. 
	/// @param amount Array length of amounts. 
	error Shares_UnequalLength(uint256 targets, uint256 amount);

	function burn(uint256) external;
}