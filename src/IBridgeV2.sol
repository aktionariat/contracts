// SPDX-License-Identifier: MIT
// Copied from https://github.com/Uniswap/uniswap-v2-periphery/blob/master/contracts/UniswapV2Router02.sol
pragma solidity >=0.8;

interface IGovernanceRegistry {

    function isAddressValid(address[] calldata _trustedIntermediaries, address _address) external view returns (bool);

}