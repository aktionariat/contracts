// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IShares {

	/*//////////////////////////////////////////////////////////////
                            Custom errors
	//////////////////////////////////////////////////////////////*/
	/// New total shares can't be below current valid supply
	/// @param totalSupply  The current valid supply. 
	/// @param newTotalShares  The new max shares. 
	error Shares_InvalidTotalShares(uint256 totalSupply, uint256 newTotalShares);
	/// Array lengths have to be equal. 
	/// @param targets Array length of targets. 
	/// @param amount Array length of amounts. 
	error Shares_UnequalLength(uint256 targets, uint256 amount);
	/// It isn't possible to mint more share token than max shares in existens. 
	/// @param totalShares The max amount of shares. 
	/// @param needed The max amount of shares needed (current valid supply + new mint amount). 
	error Shares_InsufficientTotalShares(uint256 totalShares, uint256 needed);

	function burn(uint256) external;

	function totalShares() external view returns (uint256);
}