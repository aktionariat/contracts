/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* Proprietary License
*
* This code cannot be used without an explicit permission from the copyright holder.
*
* Copyright (c) 2021 Aktionariat AG (aktionariat.com), All rights reserved.
*/
pragma solidity ^0.8.0;

import "../ERC20/IERC20.sol";
import "../ERC20/IERC677Receiver.sol";
import "../recovery/IRecoveryHub.sol";
import "../recovery/IRecoverable.sol";
import "../draggable/IDraggable.sol";
import "../draggable/IOffer.sol";
import "../utils/Ownable.sol";
import "../utils/Initializable.sol";

/// @title Lockup Shares
/// @notice Contract with a strict lock up. Lockup shares can be taken back by the company. No shares can be withdrawn until the lock up ended. After the end of the Lockup, the shares can be withdrawn.
contract LockupShares is Ownable, Initializable, IERC20, IERC677Receiver {
    /// @return The company address that locks the tokens.
	address public company;
    /// @return The token address of the locked up tokens.
	IERC20 public token;
    /// @return The timestamp at which the lockup period ends.
	uint256 public lockupEnd;

    /// @notice Emitted when new lockup contract is created.
    /// @param token The token that is locked up in the contract.
    /// @param beneficiary The beneficiary address of the contract.
    /// @param company The company address of the contract.
    /// @param lockupEnd The time when the lockup ends.
	event LockupCreated(IERC20 indexed token, address indexed beneficiary, address indexed company, uint256 lockupEnd);
    /// @notice Emitted when the lockup time gets updated.
    /// @param token The token that is locked up in the contract.
    /// @param beneficiary The beneficiary of the contract.
    /// @param lockupEnd The time when the lockup ends.
	event LockupUpdated(IERC20 indexed token, address indexed beneficiary, uint256 lockupEnd);
    /// @notice Emitted when new tokens get transfered into the lockup.
    /// @param token The token that is locked up in the contract.
    /// @param beneficiary The beneficiary of the contract.
    /// @param amount The amount of tokens that get locked up.
	event LockupToken(IERC20 indexed token, address indexed beneficiary, uint256 amount);

	modifier onlyCompany() {
		require(company == msg.sender, "not company");
		_;
	}

	constructor() Ownable(address(0)) {}

	function initialize(address _beneficiary, address _company, IERC20 _token, uint256 _lockupPeriod) external initializer {
		owner = _beneficiary;
		company = _company;
		token = _token;
		lockupEnd = block.timestamp + _lockupPeriod;
		emit LockupCreated(_token, _beneficiary, _company, lockupEnd);
	}

	/// @notice Allows the company to claw back some shares that have not vested yet.
    /// @param target Address where to claw back the tokens to.
    /// @param amount How many tokens to claw back.
	function clawback(address target, uint256 amount) external onlyCompany {
		require(token.transfer(target, amount), "clawback failed");
	}

    /// @notice Changes the lockup period of this contract.
    /// @param lockupPeriod The period the withdrawl is locked from the current block time.
	function changeLockup(uint256 lockupPeriod) external onlyCompany {
		lockupEnd = block.timestamp + lockupPeriod;
		emit LockupUpdated(token, owner, lockupEnd);
	}

	/// @notice The number of tokens currently residing on this contract.
    /// @return The token balance that is locked up in this contract.
	function balance() public view returns (uint256) {
		return token.balanceOf(address(this));
	}

	/// @notice Allow the withdrawal of any token deposited in this contract.
	/// @dev For locked up tokens the lockup period needs to be respected.
    /// @param ercAddress The erc20 token address.
    /// @param to The addresse where to withdraw the tokens to.
    /// @param amount The amount of tokens to withdraw.
	function withdraw(IERC20 ercAddress, address to, uint256 amount) external onlyOwner {
		if (ercAddress == token) {
			require(block.timestamp >= lockupEnd, "Lockup");
		}
		require(ercAddress.transfer(to, amount), "withdraw failed");
	}

	/// @notice Deposit more tokens for which lockup applies.
	/// @param amount The amount of tokens that gets added.
    /// @return true if transfer was successful.
	function onTokenTransfer(address, uint256 amount, bytes calldata) external override returns (bool) {
		require(msg.sender == address(token), "Wrong token sent");
		emit LockupToken(token, msg.sender, amount);
		return true;
	}

	/// @dev Protect deposited tokens from false recovery claims.
	function protect() external onlyOwner {
		IRecoveryHub(IRecoverable(address(token)).recovery()).clearClaimFromUser(IRecoverable(address(this)));
	}

	/// @notice Unwrap draggable shares after a migration of acquisition. 
    /// @dev Typically, keepRestriction should be true for migrations and false for acquisitions. If it is set, the lockup will continue to apply for the new unwrapped token.
    /// @param keepRestrictions Takes over restrictions to migrated token.
	function unwrap(bool keepRestrictions) external onlyCompany {
		IDraggable draggable = IDraggable(address(token));
		if (keepRestrictions) {
			token = IERC20(draggable.wrapped());
		} else {
			// owner is now free to withdraw the new token
		}
		draggable.unwrap(balance());
	}

	/// @notice Vote in the draggable contract.
    /// @param yes Indicates if the vote is yes or not.
	function vote(bool yes) external onlyOwner {
		IOffer offer = IOffer(IDraggable(address(token)).offer());
		if (yes) {
			offer.voteYes();
		} else {
			offer.voteNo();
		}
	}

	function name() external view override returns (string memory) {
        return string(abi.encodePacked("locked ", token.name()));
    }

	function symbol() external view override returns (string memory) {
        return string(abi.encodePacked("l", token.symbol()));
    }

	function decimals() external view override returns (uint8) {
        return token.decimals();
    }

	function totalSupply() external view override returns (uint256) {
        return balance();
    }

	function balanceOf(address account) external view override returns (uint256) {
        require(owner == account, "only beneficiary");
        return balance();
    }

	function transfer(address, uint256) external pure override returns (bool) {
        revert("Locked tockens can't be transferred");
    }

	function allowance(address, address) external pure override returns (uint256) {
        revert("Locked tockens can't be transferred");
    }

	function approve(address, uint256) external pure override returns (bool) {
        revert("Locked tockens can't be transferred");
    }

	function transferFrom(address, address, uint256)  external pure override returns (bool) {
        revert("Locked tockens can't be transferred");
    }
}