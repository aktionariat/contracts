// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {IAny2EVMMessageReceiver} from "@chainlink/contracts-ccip/contracts/interfaces/IAny2EVMMessageReceiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockCCIPRouter is IRouterClient {
    uint256 public fee;
    uint256 public totalFeesCollected;
    uint64[] public sentChains;

    function setFee(uint256 fee_) external {
        fee = fee_;
    }

    function isChainSupported(uint64) external pure returns (bool supported) {
        return true;
    }

    function getFee(uint64, Client.EVM2AnyMessage memory) external view returns (uint256) {
        return fee;
    }

    function ccipSend(uint64 destinationChainSelector, Client.EVM2AnyMessage calldata message)
        external payable
        returns (bytes32)
    {
        if (message.feeToken == address(0x0)) {
            require(msg.value >= fee, "MockCCIPRouter: insufficient msg.value");
        } else {
            IERC20(message.feeToken).transferFrom(msg.sender, address(this), fee);
        }
        totalFeesCollected += fee;
        sentChains.push(destinationChainSelector);
        return keccak256(abi.encode(destinationChainSelector, block.number, msg.sender, msg.value));
    }

    function deliver(Client.Any2EVMMessage calldata message, address receiver) external {
        IAny2EVMMessageReceiver(receiver).ccipReceive(message);
    }
}
