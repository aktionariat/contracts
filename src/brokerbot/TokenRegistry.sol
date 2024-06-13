// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {BrokerbotRegistry} from "./BrokerbotRegistry.sol";
import {Ownable} from "../utils/Ownable.sol";

/**
 * @title TokenRegistry
 * @author rube-de
 *
 * @notice This contract manages a registry of share tokens and allows adding/removing tokens from the registry.
 *
 * @dev Only the contract owner or the BrokerbotRegistry contract can add tokens to the registry.
 */
contract TokenRegistry is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @dev Set of share token addresses
    EnumerableSet.AddressSet private _shareTokenSet;

    /// @dev Address of the BrokerbotRegistry contract
    BrokerbotRegistry public brokerbotRegistry;

    /**
     * @notice Emitted when a new share token is added to the registry
     *
     * @param adr The address of the added share token
     */
    event ShareTokenAdded(address adr);

    /**
     * @notice Emitted when a share token is removed from the registry
     *
     * @param adr The address of the removed share token
     */
    event ShareTokenRemoved(address adr);

    /**
     * @notice Emitted when the BrokerbotRegistry address is updated
     *
     * @param adr The new address of the BrokerbotRegistry contract
     */
    event BrokerbotRegistryUpdated(BrokerbotRegistry adr);

    /// @dev Error thrown when an unauthorized address tries to add a share token
    error TokenRegistry__Unauthorized();

    /**
     * @notice Constructor to set the contract owner and BrokerbotRegistry address
     *
     * @param _owner The address of the contract owner
     * @param _brokerbotRegistry The address of the BrokerbotRegistry contract
     */
    constructor(address _owner, BrokerbotRegistry _brokerbotRegistry) Ownable(_owner) {
        brokerbotRegistry = _brokerbotRegistry;
    }

    /**
     * @dev Modifier to restrict access to only the contract owner or the BrokerbotRegistry contract
     */
    modifier onlyOwnerOrRegistry() {
        if (msg.sender != owner && msg.sender != address(brokerbotRegistry))
            revert TokenRegistry__Unauthorized();
        _;
    }

    /**
     * @notice Updates the BrokerbotRegistry address
     *
     * @param _brokerbotRegistry The new address of the BrokerbotRegistry contract
     */
    function setBrokerbotRegistry(BrokerbotRegistry _brokerbotRegistry) external onlyOwner() {
        brokerbotRegistry = _brokerbotRegistry;
        emit BrokerbotRegistryUpdated(_brokerbotRegistry);
    }

    /**
     * @notice Adds a new share token to the registry
     *
     * @param adr The address of the share token to be added
     *
     * @return bool True if the token was added successfully, false otherwise
     */
    function addShareToken(address adr) external onlyOwnerOrRegistry() returns (bool) {
        bool added = _shareTokenSet.add(adr);
        if (added) emit ShareTokenAdded(adr);
        return added;
    }

    /**
     * @notice Removes a share token from the registry
     *
     * @param adr The address of the share token to be removed
     *
     * @return bool True if the token was removed successfully, false otherwise
     */
    function removeShareToken(address adr) external onlyOwner() returns (bool) {
        bool removed = _shareTokenSet.remove(adr);
        if (removed) emit ShareTokenRemoved(adr);
        return removed;
    }

    /**
     * @notice Checks if a given address is a share token in the registry
     *
     * @param adr The address to check
     *
     * @return bool True if the address is a share token, false otherwise
     */
    function cointainsShareToken(address adr) external view returns (bool) {
        return _shareTokenSet.contains(adr);
    }

    /**
     * @notice Returns the number of share tokens in the registry
     *
     * @return uint256 The number of share tokens in the registry
     */
    function amountOfShareToken() external view returns (uint256) {
        return _shareTokenSet.length();
    }

    /**
     * @notice Returns an array of all share token addresses in the registry
     *
     * @return address[] An array of share token addresses
     */
    function getAllShareToken() external view returns (address[] memory) {
        return _shareTokenSet.values();
    }
}
