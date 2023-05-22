pragma solidity ^0.8.0;

import "../ERC20/IERC20.sol";
import "../ERC20/IERC677Receiver.sol";
import "../recovery/IRecoveryHub.sol";
import "../recovery/IRecoverable.sol";
import "../draggable/IDraggable.sol";
import "../draggable/IOffer.sol";
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
    event VestingUpdated(address indexed token, address indexed beneficiary, uint256 lockup, uint256 vestingstart, uint256 vestingEnd);
    event VestedTokensDeposited(address indexed token, uint256 totalReceived);

    /// @param sender The unauthorized msg.sender. 
    error EmployeeShares_InvalidSender(address sender);
    /// @param balance The existing balance. 
    /// @param needed The needed balance. 
    error EmployeeShares_InsufficientBalance(uint256 balance, uint256 needed);
    /// @param currentTimestamp Current block.timestamp. 
    /// @param lockupEnd Timestamp when the lockup ends. 
    error EmployeeShares_BeforeLockupEnd(uint256 currentTimestamp, uint256 lockupEnd);

    constructor(address employee, address company_, IERC20 token_, uint256 vestingStart_, uint256 vestingPeriod, uint256 lockupPeriod) Ownable(employee){
        company = company_;
        token = token_;
        vestingStart = vestingStart_;
        vestingEnd = vestingStart_ + vestingPeriod;
        lockupEnd = block.timestamp + lockupPeriod;
        emit VestingUpdated(address(token_), employee, lockupEnd, vestingStart_, vestingEnd);
    }

    modifier onlyCompany {
        if (msg.sender != company) {
            revert EmployeeShares_InvalidSender(msg.sender);
        }
        _;
    }

    /**
     * Allows the company to claw back some shares that have not vested yet.
     */
    function clawback(address target, uint256 amount) external onlyCompany{
        if (amount > balance() - vested()) {
            revert EmployeeShares_InsufficientBalance(balance() - vested(), amount);
        }
        token.transfer(target, amount);
    }

    function liftLockup() external onlyCompany {
        lockupEnd = block.timestamp;
        emit VestingUpdated(address(token), owner, lockupEnd, vestingStart, vestingEnd);
    }

    function endVesting() external onlyCompany{
        vestingEnd = block.timestamp;
        emit VestingUpdated(address(token), owner, lockupEnd, vestingStart, vestingEnd);
    }

    /**
     * The number of tokens currently residing on this contract.
     */
    function balance() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * Returns the number of vested shares,
     * whreas: 0 <= vested() <= received
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
     * Allow the withdrawal of any token deposited in this contract.
     * For the vested token, lockup and vesting need to be respected.
     */
    function withdraw(address ercAddress, address to, uint256 amount) external onlyOwner() {
        if(ercAddress == address(token)){
            if (lockupEnd > block.timestamp) {
                revert EmployeeShares_BeforeLockupEnd(block.timestamp, lockupEnd);
            }
            // ensure not more is withdrawn than allowed
            if (amount > vested() + balance() - received) {
                revert EmployeeShares_InsufficientBalance(vested() + balance() - received, amount);
            }
        }
        IERC20(ercAddress).transfer(to, amount);
    }

    /**
     * Deposit more tokens for which vesting applies.
     */
    function onTokenTransfer(address, uint256 amount, bytes calldata) external override returns (bool) {
        if (msg.sender != address(token)) {
            revert EmployeeShares_InvalidSender(msg.sender);
        }
        received += amount;
        emit VestedTokensDeposited(msg.sender, received);
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
     * for acquisitions. If it is set, the vesting and lockup will continue
     * to apply for the new unwrapped token.
     */
    function unwrap(bool keepRestrictions) external onlyCompany {
        uint256 startBalance = balance();
        IDraggable draggable = IDraggable(address(token));
        draggable.unwrap(startBalance);
        if (keepRestrictions) {
            token = IERC20(draggable.wrapped());
            received = received * balance() / startBalance;
        } else {
            // owner is now free to withdraw the new token
        }
    }

    /**
     * Vote in the draggable contract.
     */
    function vote(bool yes) external onlyOwner {
        IOffer offer = IOffer(IDraggable(address(token)).offer());
        if (yes){
            offer.voteYes();
        } else {
            offer.voteNo();
        }
    }

}