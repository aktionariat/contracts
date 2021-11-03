// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract IDraggable {
    
    function getOracle() public virtual returns (address);
    function drag(address buyer, address currency) external virtual;
    function notifyOfferEnded() external virtual;
    function votingPower(address voter) external virtual returns (uint256);
    function totalVotingTokens() public virtual view returns (uint256);
    function notifyVoted(address voter) external virtual;

}