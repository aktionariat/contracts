
// SPDX-License-Identifier: MIT
pragma solidity >=0.7;

interface IBaseCurrency {
    function balanceOf(address account) external view returns (uint256);
    function mint(address _to, uint256 _value) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}