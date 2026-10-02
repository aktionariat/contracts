// SPDX-License-Identifier: MIT
// Copyright (c) 2016-2025 Zeppelin Group Ltd and contributors
// Modifications Copyright (c) 2020-2026 Aktionariat AG (aktionariat.com)
// From https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol
//
// Modifications:
// - Replaced Context._msgSender() with msg.sender
// - Made leaner
// - No renounceOwnership and no zero address check: ownership is renounced with transferOwnership(address(0))

pragma solidity 0.8.37;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The owner account is given to the constructor. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
contract Ownable {

    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Ownable_NotOwner(address sender);

    /**
     * @dev Initializes the contract setting `initialOwner` as the initial owner.
     */
    constructor (address initialOwner) {
        owner = initialOwner;
        emit OwnershipTransferred(address(0), owner);
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner. The zero address renounces ownership for good.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _checkOwner() internal view {
        if (msg.sender != owner) {
            revert Ownable_NotOwner(msg.sender);
        }
    }
}