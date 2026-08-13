// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {IAny2EVMMessageReceiver} from "@chainlink/contracts-ccip/contracts/interfaces/IAny2EVMMessageReceiver.sol";

/**
 * Test-only mock of the CCIP IRouterClient.
 *
 * Models the fee path used by MultichainWallet.sync: a fixed per-message fee that
 * must be supplied as msg.value (the real router accepts an overpayment but never
 * refunds it, so this mock requiring exactly >= fee is behaviourally equivalent for
 * the accounting under test). Tracks the total fees collected and the chains that
 * were sent to, so tests can assert who actually paid for each message.
 */
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

    function ccipSend(uint64 destinationChainSelector, Client.EVM2AnyMessage calldata)
        external payable
        returns (bytes32)
    {
        require(msg.value >= fee, "MockCCIPRouter: insufficient msg.value");
        totalFeesCollected += fee;
        sentChains.push(destinationChainSelector);
        return keccak256(abi.encode(destinationChainSelector, block.number, msg.sender, msg.value));
    }

    /**
     * Test-only: delivers a message to a CCIPReceiver by calling its ccipReceive, with this
     * contract as msg.sender (i.e. as the router). Lets tests exercise _ccipReceive payloads
     * directly, including simulating out-of-order / duplicated delivery.
     */
    function deliver(Client.Any2EVMMessage calldata message, address receiver) external {
        IAny2EVMMessageReceiver(receiver).ccipReceive(message);
    }
}
