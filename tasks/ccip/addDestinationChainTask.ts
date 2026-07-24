// TODO
//
// Function to be called on LockReleaseTokenPool:
// works on any pool since it is implemented by general TokenPoolInterface
//
// Bridging
//
//   /// @notice Sets the permissions for a list of chains selectors. Actual senders for these chains
//   /// need to be allowed on the Router to interact with this pool.
//   /// @param remoteChainSelectorsToRemove A list of chain selectors to remove.
//   /// @param chainsToAdd A list of chains and their new permission status & rate limits. Rate limits
//   /// are only used when the chain is being added through `allowed` being true.
//   /// @dev Only callable by the owner
//   function applyChainUpdates(
//     uint64[] calldata remoteChainSelectorsToRemove,
//     ChainUpdate[] calldata chainsToAdd
//   ) external virtual onlyOwner
