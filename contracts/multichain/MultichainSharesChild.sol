/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* MIT License with Automated License Fee Payments
*
* Copyright (c) 2025 Aktionariat AG (aktionariat.com)
*
* Permission is hereby granted to any person obtaining a copy of this software
* and associated documentation files (the "Software"), to deal in the Software
* without restriction, including without limitation the rights to use, copy,
* modify, merge, publish, distribute, sublicense, and/or sell copies of the
* Software, and to permit persons to whom the Software is furnished to do so,
* subject to the following conditions:
*
* - The above copyright notice and this permission notice shall be included in
*   all copies or substantial portions of the Software.
* - All automated license fee payments integrated into this and related Software
*   are preserved.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/

pragma solidity >=0.8.0 <0.9.0;

import "../ERC20/ERC20Named.sol";
import "../recovery/ERC20Recoverable.sol";
import "../ERC20/ERC20PermitLight.sol";
import "../ERC20/ERC20Permit2.sol";
import "./CCIPAdministrable.sol";

contract MultichainSharesChild is ERC20Named, ERC20Recoverable, ERC20PermitLight, ERC20Permit2, CCIPAdministrable {

  constructor(
    string memory _name,
    string memory _symbol,
    string memory _terms,
    IRecoveryHub _recoveryHub,
    address _owner,
    Permit2Hub _permit2Hub,
    address _ccipAdmin
  )
    ERC20Named(_name, _symbol, 0, _owner)
    ERC20Recoverable(_recoveryHub)
    ERC20Permit2(_permit2Hub)
    CCIPAdministrable(_ccipAdmin)
  {

  }

  function allowance(address owner, address spender) public view virtual override(ERC20Permit2, ERC20Flaggable, IERC20) returns (uint256) {
      return super.allowance(owner, spender);
  }

  function transfer(address to, uint256 value) virtual override(IERC20, ERC20Flaggable, ERC20Recoverable) public returns (bool) {
      return super.transfer(to, value);
  }

  function getClaimDeleter() public view override returns (address) {
      return owner;
  }

  function mint(address target, uint256 amount) public onlyCCIPMinter {
      _mint(target, amount);
  }

  function burn(uint256 _amount) external {
      _transfer(msg.sender, address(this), _amount);
      _burn(address(this), _amount);
  }

  function burnFrom(address _from, uint256 _amount) external onlyCCIPBurner {
      _transfer(_from, address(this), _amount);
      _burn(address(this), _amount);
  }
}