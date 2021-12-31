// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract IOffer {
	function makeCompetingOffer(address newOffer) external virtual;

	function notifyMoved(address from, address to, uint256 value) external virtual;
}