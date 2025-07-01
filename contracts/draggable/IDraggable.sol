// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../ERC20/IERC20.sol";
import "./IOffer.sol";
interface IDraggable is IERC20 {

    /*//////////////////////////////////////////////////////////////
                            Custom errors
    //////////////////////////////////////////////////////////////*/
    /// conversion factor has to be > 0 for this transaction.
    error Draggable_NotBinding();
    /// conversion factor has to be = 0 for this transaction.
    error Draggable_IsBinding();
    /// conversion factor can't be 0 if binding gets deactivated.
    error Draggable_FactorZero();
    
    function wrapped() external view returns (IERC20);
    function unwrap(uint256 amount) external;

    function setOracle(address newOracle) external;
    function oracle() external view returns (address);
    function setTerms(string calldata _terms) external;
    function drag(address buyer, IERC20 currency, uint256 pricePerShare) external;
    function migrate(address successor) external;
    

}
