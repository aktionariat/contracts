// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./SecondaryMarket.sol";

contract SecondaryMarketFactory {

    address public constant REACTOR = address(0x0); // TODO: set the reactor address here
    bytes32 public constant SALT = bytes32(uint256(21092025));

    event SecondaryMarketDeployed(address indexed owner, address market, address router);

    /**
     * @notice Deploys a new SecondaryMarket contract using CREATE2
     * @param owner The owner of the SecondaryMarket
     * @param router The router address
     * @return market The address of the deployed SecondaryMarket
     */
    function deploy(address owner, address router, address currency) external returns (address) {
        SecondaryMarket market = new SecondaryMarket{salt: SALT}(owner, REACTOR, router, currency);
        emit SecondaryMarketDeployed(owner, address(market), router);
        return address(market);
    }

    /**
     * @notice Predicts the address where a SecondaryMarket will be deployed
     * @param owner The owner of the SecondaryMarket
     * @param router The router address
     * @return predicted The predicted deployment address
     */
    function predict(address owner, address router, address currency) external view returns (address predicted) {
        bytes memory initCode = abi.encodePacked(type(SecondaryMarket).creationCode, abi.encode(owner, REACTOR, router, currency));
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), SALT, keccak256(initCode)));
        return address(uint160(uint256(hash)));
    }

    /**
     * @notice Checks if a SecondaryMarket is already deployed at the predicted address
     * @param owner The owner of the SecondaryMarket
     * @param router The router address
     * @return isDeployed True if a contract exists at the predicted address
     */
    function isDeployed(address owner, address router, address currency) external view returns (bool) {
        address predictedAddress = this.predict(owner, router, currency);
        uint32 size;
        assembly {
            size := extcodesize(predictedAddress)
        }
        return size > 0;
    }
}