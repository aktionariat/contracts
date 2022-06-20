pragma solidity ^0.8.0;

import "../ERC20/IERC20.sol";
import "../ERC20/IERC677Receiver.sol";
import "../recovery/IRecoveryHub.sol";
import "../recovery/IRecoverable.sol";
import "../utils/Ownable.sol";

/**
 * Employee contract with a strict lock up and linear vesting.
 * Shares that have not vested yet can be taken back by the company.
 * No shares can be withdrawn until the lock up ended. After the end of the lockup, the vested shares can be withdrawn.
 */
contract EmployeeShares is Ownable, IERC677Receiver {

    address public company;
    IERC20 public token;

    uint256 public received;
    uint256 public vestingStart;
    uint256 public vestingEnd;
    uint256 public lockupEnd;

    // TODO: events on creation and notable actions

    constructor(address employee, address company_, IERC20 token_, uint256 vestingStart_, uint256 vestingPeriod, uint256 lockupPeriod) Ownable(employee){
        company = company_;
        token = token_;
        vestingStart = vestingStart_;
        vestingEnd = vestingStart_ + vestingPeriod;
        lockupEnd = block.timestamp + lockupPeriod;
    }

    /**
     * Allows the company to claw back all the shares that have not vested yet.
     */
    function clawback(address target) external {
        require(msg.sender == company);
        token.transfer(target, balance() - vested());
    }

    /**
     * The number of tokens currently residing on this contract.
     */
    function balance() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * Returns the number of vested shares.
     */
    function vested() public view returns (uint256) {
        uint256 time = block.timestamp;
        if (time <= vestingStart){
            return 0;
        } else if (time >= vestingEnd){
            return received;
        } else {
            uint256 passed = time - vestingStart;
            uint256 total = vestingEnd - vestingStart;
            return received * passed / total;
        }
    }

    /**
     * Claim vested shares after the lockup ended.
     */
    function release(address target) external onlyOwner {
        require(block.timestamp >= lockupEnd);
        uint256 alreadyWithdrawn = received - balance();
        uint256 available = vested() - alreadyWithdrawn;
        token.transfer(target, available);
    }

    /**
     * Deposit more tokens.
     */
    function onTokenTransfer(address, uint256 amount, bytes calldata) external override returns (bool) {
        require(msg.sender == address(token));
        received += amount;
        return true;
    }

    /**
     * Protect deposited tokens from false recovery claims.
     */
    function protect() external onlyOwner {
        IRecoveryHub(IRecoverable(address(token)).recovery()).clearClaimFromUser(IRecoverable(address(this)));
    }

}