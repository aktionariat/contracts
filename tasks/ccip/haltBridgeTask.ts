// TODO
// you could use the removeRemotePool function but it will still have
// the inflight problem, and it does not have

//   /// @notice Removes the remote pool address for a given chain selector.
//   /// @dev All inflight txs from the remote pool will be rejected after it is removed. To ensure no loss of funds, there
//   /// should be no inflight txs from the given pool.
//   function removeRemotePool(uint64 remoteChainSelector, bytes calldata remotePoolAddress) external onlyOwner
