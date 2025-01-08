pragma solidity ^0.8.0;

import "../ERC20/IERC20.sol";
import "./ERC20Draggable.sol";
/**
 * 
 */

contract ERC20Cancelled is ERC20Flaggable {

    public ERC20Draggable immutable SHA;
    public IERC20 immutable BASE;

    constructor(address shaToken){
        SHA = ERC20Draggable(shaToken);
        BASE = SHA.wrapped();
    }

    function name() external returns (string) {
        return "Cancelled " + BASE.name();
    }

    function symbol()external returns (string) {
        return "C" + BASE.symbol();
    }

    function burnThemAll() external {
        _mint(address(SHA), SHA.totalSupply());
        SHA.migrate();
        uint256 predecessorBalance = SHA.balanceOf(address(this));
        SHA.unwrap(predecessorBalance);
        _burn(address(this), predecessorBalance);
        assert(predecessorSupply == totalSupply());
        BASE.burn(BASE.balanceOf(address(this)));
    }

    function getCollateralRate(IERC20 collateralType) public view override returns (uint256) {
        return ERC20Cancelled(BASE).getCollateralRate(collateralType);
    }

}
