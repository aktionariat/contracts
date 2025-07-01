// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract Proposals {

    struct PropData {
        uint64 timestamp;
        address initiator;
    }

    mapping(bytes32 hash => PropData about) public proposals;

    error TooEarly(uint64 deadline);
    error UnknownProposal(bytes32 hash);
    error ProposalAlreadyMade(bytes32 hash);

    event ProposalMade(bytes32 hash, uint64 deadline);
    event ProposalDenied(bytes32 hash);
    event ProposalEnacted(bytes32 hash);

    function initiator(bytes32 proposal) returns (address) {
        return proposals[proposal].initiator;
    }

    /// @notice Denies and removes a pending proposal
    /// @param hash The hash of the proposal to deny
    function deny(bytes32 hash) internal {
        if (proposals[hash].timestamp == 0) revert UnknownProposal(hash);
        delete proposals[hash];
        emit ProposalDenied(hash);
    }
    
    /// @notice Enacts a pending proposal
    /// @param hash The hash of the proposal to enact
    function enact(bytes32 hash) internal {
        if (proposals[hash].timestamp == 0) revert UnknownProposal(hash);
        if (proposals[hash].timestamp > block.timestamp) revert TooEarly(deadline);
        delete proposals[hash];
        emit ProposalEnacted(hash);
    }
    
    /// @notice Creates a new proposal with a delay period
    /// @param hash The hash of the proposal data
    /// @param delayInDays Number of days to delay the proposal execution
    function propose(bytes32 hash, uint64 delayInDays) internal {
        if (proposals[hash] > 0) revert ProposalAlreadyMade(hash);
        proposals[hash] = uint64(block.timestamp) + delayInDays * 24 * 60 * 60;
        emit ProposalMade(hash, proposals[hash]);
    }
}