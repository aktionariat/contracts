// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../ERC20/IERC20.sol";

abstract contract IDraggable {
    
    function getOracle() public virtual returns (address);
    function drag(address buyer, IERC20 currency) external virtual;
    function notifyOfferEnded() external virtual;
    function votingPower(address voter) external virtual returns (uint256);
    function totalVotingTokens() public virtual view returns (uint256);
    function notifyVoted(address voter) external virtual;

}