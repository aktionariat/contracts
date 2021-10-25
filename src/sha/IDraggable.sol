// SPDX-License-Identifier: MIT
pragma solidity >=0.8;

abstract contract IDraggable {
    
    function getOracle() public virtual returns (address);
    function drag(address buyer, address currency) public virtual;
    function notifyOfferEnded() public virtual;
    function votingPower(address voter) public virtual returns (uint256);
    function totalVotingTokens() public virtual view returns (uint256);
    function notifyVoted(address voter) public virtual;

}