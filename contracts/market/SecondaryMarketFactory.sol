// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./SecondaryMarket.sol";

contract SecondaryMarketFactory {

    bytes32 public constant SALT = bytes32(uint256(20251020));

    event SecondaryMarketDeployed(address indexed owner, address market);

    /**
     * @notice Deploys a new SecondaryMarket contract using CREATE2
     * @param owner The owner of the SecondaryMarket
     * @param router The router address
     * @return market The address of the deployed SecondaryMarket
     */
    function deploy(address owner, address currency, address token, address reactor, address router) external returns (address) {
        SecondaryMarket market = new SecondaryMarket{salt: SALT}(owner, currency, token, reactor, router);
        emit SecondaryMarketDeployed(owner, address(market));
        return address(market);
    }

    /**
     * @notice Predicts the address where a SecondaryMarket will be deployed
     * @param owner The owner of the SecondaryMarket
     * @param router The router address
     * @return predicted The predicted deployment address
     */
    function predict(address owner, address currency, address token, address reactor, address router) external view returns (address predicted) {
        bytes memory initCode = abi.encodePacked(type(SecondaryMarket).creationCode, abi.encode(owner, currency, token, reactor, router));
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), SALT, keccak256(initCode)));
        return address(uint160(uint256(hash)));
    }

    /**
     * @notice Checks if a SecondaryMarket is already deployed at the predicted address
     * @param owner The owner of the SecondaryMarket
     * @param router The router address
     * @return isDeployed True if a contract exists at the predicted address
     */
    function isDeployed(address owner, address currency, address token, address reactor, address router) external view returns (bool) {
        address predictedAddress = this.predict(owner, currency, token, reactor, router);
        uint32 size;
        assembly {
            size := extcodesize(predictedAddress)
        }
        return size > 0;
    }
}