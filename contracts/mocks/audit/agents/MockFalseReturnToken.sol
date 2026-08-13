// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

// A token whose transfer/transferFrom/approve always return false WITHOUT
// reverting and perform NO state change. Callers that ignore the return
// value believe the transfer succeeded.
contract MockFalseReturnToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;
    string public name = "MockFalseReturnToken";
    string public symbol = "FRTN";
    uint8 public decimals = 18;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }

    function approve(address, uint256) external pure returns (bool) {
        return false;
    }
}
