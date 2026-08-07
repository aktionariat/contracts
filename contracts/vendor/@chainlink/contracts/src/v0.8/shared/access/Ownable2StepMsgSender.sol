// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {Ownable2Step} from "./Ownable2Step.sol";

/// @notice Sets the msg.sender to be the owner of the contract and does not set a pending owner.
contract Ownable2StepMsgSender is Initializable, Ownable2Step {
    constructor() Ownable2Step(msg.sender, address(0)) {}

    /**
     * Proxy constructor.
     * @dev No changes from regular constructor
     */
    function __Ownable2StepMsgSender_init() internal onlyInitializing {
        __Ownable2Step_init(msg.sender, address(0));
    }
}
