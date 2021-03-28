// SPDX-License-Identifier: MIT
pragma solidity >=0.8;

abstract contract IDraggable {
    
    function unwrap(uint256 amount) virtual public returns (address, uint256);
    function drag(address buyer, address currency) public virtual;
    function notifyOfferEnded() public virtual;

}