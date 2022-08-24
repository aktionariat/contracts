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
	address public company;
	IERC20 public token;

	uint256 public lockupEnd;

	event LockupCreated(IERC20 indexed token, address indexed beneficiary, uint256 lockupEnd);
	event LockupUpdated(IERC20 indexed token, address indexed beneficiary, uint256 lockupEnd);
	event LockupToken(IERC20 indexed token, address indexed beneficiary, uint256 amount);

	modifier onlyCompany() {
		require(company == msg.sender, "not company");
		_;
	}

	constructor() Ownable(address(0)) {}

	function initialize(address beneficiary, address _company, IERC20 _token, uint256 LockupPeriod) external initializer {
		owner = beneficiary;
		company = _company;
		token = _token;
		lockupEnd = block.timestamp + LockupPeriod;
		emit LockupCreated(_token, beneficiary, lockupEnd);
	}

	/**
	 * Allows the company to claw back some shares that have not vested yet.
	 */
	function clawback(address target, uint256 amount) external onlyCompany {
		token.transfer(target, amount);
	}

	function changeLockup(uint256 LockupPeriod) external onlyCompany {
		lockupEnd = block.timestamp + LockupPeriod;
		emit LockupUpdated(token, owner, lockupEnd);
	}

	/**
	 * The number of tokens currently residing on this contract.
	 */
	function balance() public view returns (uint256) {
		return token.balanceOf(address(this));
	}

	/**
	 * Allow the withdrawal of any token deposited in this contract.
	 * For the vested token, Lockup and vesting need to be respected.
	 */
	function withdraw(IERC20 ercAddress, address to, uint256 amount) external onlyOwner {
		if (ercAddress == token) {
			require(block.timestamp >= lockupEnd, "Lockup");
		}
		ercAddress.transfer(to, amount);
	}

	/**
	 * Deposit more tokens for which vesting applies.
	 */
	function onTokenTransfer(address, uint256 amount, bytes calldata) external override returns (bool) {
		require(msg.sender == address(token));
		emit LockupToken(token, msg.sender, amount);
		return true;
	}

	/**
	 * Protect deposited tokens from false recovery claims.
	 */
	function protect() external onlyOwner {
		IRecoveryHub(IRecoverable(address(token)).recovery()).clearClaimFromUser(IRecoverable(address(this)));
	}

	/**
	 * Unwrap draggable shares after a migration of acquisition.
	 * Typically, keepRestriction should be true for migrations and false
	 * for acquisitions. If it is set, the vesting and Lockup will continue
	 * to apply for the new unwrapped token.
	 */
	function unwrap(bool keepRestrictions) external onlyCompany {
		uint256 startBalance = balance();
		IDraggable draggable = IDraggable(address(token));
		draggable.unwrap(startBalance);
		if (keepRestrictions) {
			token = IERC20(draggable.wrapped());
		} else {
			// owner is now free to withdraw the new token
		}
	}

	/**
	 * Vote in the draggable contract.
	 */
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
        revert("Locked tockens can't be transfered");
    }

	function allowance(address, address) external pure override returns (uint256) {
        revert("Locked tockens can't be transfered");
    }

	function approve(address, uint256) external pure override returns (bool) {
        revert("Locked tockens can't be transfered");
    }

	function transferFrom(address, address, uint256)  external pure override returns (bool) {
        revert("Locked tockens can't be transfered");
    }
}