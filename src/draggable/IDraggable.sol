// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../ERC20/IERC20.sol";
import "./IOffer.sol";
interface IDraggable is IERC20 {

    /*//////////////////////////////////////////////////////////////
                            Custom errors
    //////////////////////////////////////////////////////////////*/
    /// conversion factor has to be > 0 for this transaction.
    error Draggable_NotBinding();
    /// conversion factor has to be = 0 for this transaction.
    error Draggable_IsBinding();
    /// conversion factor can't be 0 if binding gets deactivated.
    error Draggable_FactorZero();
    /// erc20 transfer didn't succeded.
    error Draggable_TransferFailed();
    /// the reported votes can't be > max voting tokens.
    /// @param maxVotes The max voting tokens.
    /// @param reportedVotes The actual reported votes.
    error Draggable_TooManyVotes(uint256 maxVotes, uint256 reportedVotes);
    /// there is still an open offer that has to be canceled first
    error Draggable_OpenOffer();
    /// For migration the quorum needs to be reached.
    /// @param needed The needed quorum.
    /// @param actual The current yes votes.
    error Draggable_QuorumNotReached(uint256 needed, uint256 actual);
    
    function wrapped() external view returns (IERC20);
    function unwrap(uint256 amount) external;
    function offer() external view returns (IOffer);
    function oracle() external view returns (address);
    function drag(address buyer, IERC20 currency) external;
    function notifyOfferEnded() external;
    function votingPower(address voter) external returns (uint256);
    function totalVotingTokens() external view returns (uint256);
    function notifyVoted(address voter) external;
    function migrate() external;
    function setOracle(address newOracle) external;
    function migrateWithExternalApproval(address successor, uint256 additionalVotes) external;
    function setTerms(string calldata _terms) external;


}
