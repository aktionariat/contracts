// SPDX-License-Identifier: MIT

/**
 * @title Brokerbot Registry
 * @author rube-de
 * 
 * @notice Holds a registry of all deployed active brokerbots
 * 
 * @dev This contract is used to register and manage brokerbots
 */
pragma solidity ^0.8.0;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {IBrokerbot} from "./IBrokerbot.sol";
import {IERC20} from "../ERC20/IERC20.sol";
import {Ownable} from "../utils/Ownable.sol";
import {TokenRegistry} from "./TokenRegistry.sol";

/**
 * @title Brokerbot Registry
 * @author rube-de
 * 
 * @notice Holds a registry of all deployed active brokerbots
 * 
 * @dev This contract is used to register and manage brokerbots
 */
contract BrokerbotRegistry is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet private _brokerbotSet; // Set of all registered brokerbots
    EnumerableSet.AddressSet private _activeBrokerbotSet; // Set of active brokerbots

    /**
     * @notice Returns the brokerbot address for a given base and share token pair, or address 0 if it does not exist
     * 
     * @dev mapping is [base][token] = brokerbotAddress
     * 
     * @return brokerbot The brokerbot address
     */
    mapping(IERC20 => mapping(IERC20 => IBrokerbot)) public getBrokerbot;

    /**
     * @notice Emitted when a brokerbot is registered
     * 
     * @param brokerbot The address of the registered brokerbot
     * @param base The address of the base currency
     * @param token The address of the share token
    */
    event BrokerbotRegistered(IBrokerbot brokerbot, IERC20 indexed base, IERC20 indexed token);

    /**
     * @notice Emitted when calling the syncBrokerbot function
     * 
     * @param brokerbot The brokerbot address that is synced
     */
     event BrokerbotSync(IBrokerbot indexed brokerbot);

    /**
     * @notice Emitted when a brokerbot is deactivated
     * 
     * @param brokerbot The deactivated brokerbot address
     */
    event BrokerbotDeactivated(address indexed brokerbot);

    /**
     * @notice Constructor that sets the owner
     * 
     * @param _owner The address of the owner
     */
    constructor(address _owner) Ownable(_owner) {}

    /**
     * @notice Registers a new brokerbot
     * 
     * @dev Per network, only one active brokerbot should exist per base/share token pair
     * 
     * @param _brokerbot The brokerbot contract to be registered
     * @param _tokenRegistry The token registry contract
     */
    function registerBrokerbot(IBrokerbot _brokerbot, TokenRegistry _tokenRegistry) external onlyOwner() {
        bool isNew = _brokerbotSet.add(address(_brokerbot));
        if (isNew) {
            IERC20 token = _brokerbot.token();
            IERC20 base = _brokerbot.base();
            _activeBrokerbotSet.add(address(_brokerbot));
            getBrokerbot[base][token] = _brokerbot;
            _tokenRegistry.addShareToken(address(token));
            emit BrokerbotRegistered(_brokerbot, base, token);
        }
    }

    /**
     * @notice Deactivates a brokerbot
     * 
     * @param brokerbot The address of the brokerbot to deactivate
     */
    function deactivateBrokerbot(address brokerbot) external onlyOwner() {
        _activeBrokerbotSet.remove(brokerbot);
        emit BrokerbotDeactivated(brokerbot);
    }

    /**
     * @notice Syncs a brokerbot
     * 
     * @dev This event is useful for indexers/subgraphs to update token balances which are not tracked with other events
     * 
     * @param _brokerbot The brokerbot to sync
     */
    function syncBrokerbot(IBrokerbot _brokerbot) external {
        emit BrokerbotSync(_brokerbot);
    }

    /**
     * @notice Gets all active brokerbots
     * 
     * @return brokerbots An array of active brokerbot addresses
     */
    function getAllActiveBrokerbots() external view returns(address[] memory brokerbots) {
        return _activeBrokerbotSet.values();
    }

    /**
     * @notice Gets all registered brokerbots
     * 
     * @return brokerbots An array of all registered brokerbot addresses
     */
    function getAllBrokerbots() external view returns (address[] memory brokerbots) {
        return _brokerbotSet.values();
    }
}
