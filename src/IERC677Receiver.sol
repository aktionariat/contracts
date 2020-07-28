// Copied from https://github.com/Uniswap/uniswap-v2-periphery/blob/master/contracts/UniswapV2Router02.sol
pragma solidity >=0.6;

interface IERC677Receiver {

    function onTokenTransfer(address from, uint256 amount, bytes calldata data) external;

}