// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract IOfferFactory {
	function create(
		bytes32 salt, address buyer, uint256 pricePerShare,	address currency,	uint256 quorum,	uint256 votePeriod
	) external payable virtual returns (address);
}