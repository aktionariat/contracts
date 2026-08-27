// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * Mock Shares successor token
 */
contract MockSuccessorToken {
    event NotifyBurned(address indexed beneficiary, uint256 amount);

    address public lastBeneficiary;
    uint256 public lastAmount;
    uint256 public notifyCount;

    function notifyBurned(address beneficiary, uint256 amount) external {
        lastBeneficiary = beneficiary;
        lastAmount = amount;
        notifyCount++;
        emit NotifyBurned(beneficiary, amount);
    }
}
