// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./DraggableShares.sol";
import "./IShares.sol";
import "../ERC20/ERC20Named.sol";
/** 
 *  
 * @dev only one of the migration function should be needed.  
 */
contract InvalidContract is ERC20Named {
  IDraggable immutable predecessor;
  IERC20 base;


  constructor(
    address _owner,
    IERC20 _base,
    IDraggable _predecessor,
    string memory _symbol,
    string memory _name
  )
    ERC20Named(_symbol, _name, 0, _owner) 
  {
    predecessor = _predecessor;
    base = _base;
  }

  function mint(address recipient, uint256 amount) external onlyOwner {
    _mint(recipient, amount);
  }


  function burn(uint256 amount) external {
    _burn(msg.sender, amount);
    IShares(address(base)).burn(amount);
  }
  
  /**
   * @notice This contract needs to hold the majority of the predecessor tokens.
   */
  function initiateMigration() external {
    uint256 predecessorSupply = predecessor.totalSupply();
    _mint(address(predecessor), predecessorSupply);
    base = predecessor.wrapped();
    predecessor.migrate();
    uint256 predecessorBalance = predecessor.balanceOf(address(this));
    predecessor.unwrap(predecessorBalance);
    _burn(address(this), predecessorBalance);
    assert(predecessorSupply == totalSupply());
  }

  function setPredecessorOracle(address oracle) external onlyOwner {
    predecessor.setOracle(oracle);
  }

  /**
   * @notice This contract needs to hold the majority of the predecessor tokens and the this contract needs to be the oracle of the predecessor.
   * 
   */
  function initiateMigrationWithExternalApproval(uint256 additionalVotes) external onlyOwner {
    uint256 predecessorSupply = predecessor.totalSupply();
    _mint(address(predecessor), predecessorSupply);
    base = predecessor.wrapped();
    predecessor.migrateWithExternalApproval(address(this), additionalVotes);
    uint256 predecessorBalance = predecessor.balanceOf(address(this));
    if (predecessorBalance > 0) {
      predecessor.unwrap(predecessorBalance);
      _burn(address(this), predecessorBalance);
    }
    assert(predecessorSupply == totalSupply());
  }
}