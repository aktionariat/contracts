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
pragma solidity 0.8.30;

contract CCIPAdministrable {

	address public CCIPAdmin;
  address public CCIPMinter;
  address public CCIPBurner;

  event CCIPAdminChanged(address indexed oldAdmin, address indexed newAdmin);
  event CCIPMinterChanged(address indexed oldMinter, address indexed newMinter);
  event CCIPBurnerChanged(address indexed oldBurner, address indexed newBurner);

  error CCIPAdministrable_NotCCIPAdmin(address sender);
  error CCIPAdministrable_NotCCIPMinter(address sender);
  error CCIPAdministrable_NotCCIPBurner(address sender);

  constructor(address _ccipAdmin) {
    CCIPAdmin = _ccipAdmin;
    CCIPMinter = _ccipAdmin;
    CCIPBurner = _ccipAdmin;

    emit CCIPAdminChanged(address(0), CCIPAdmin);
    emit CCIPMinterChanged(address(0), CCIPMinter);
    emit CCIPBurnerChanged(address(0), CCIPBurner);
  }

  function setCCIPAdmin(address newAdmin) external onlyCCIPAdmin {
    emit CCIPAdminChanged(CCIPAdmin, newAdmin);
    CCIPAdmin = newAdmin;
  }

  function setCCIPMinter(address newMinter) external onlyCCIPAdmin {
    emit CCIPAdminChanged(CCIPMinter, newMinter);
    CCIPMinter = newMinter;
  }

  function setCCIPBurner(address newBurner) external onlyCCIPAdmin {
    emit CCIPAdminChanged(CCIPBurner, newBurner);
    CCIPBurner = newBurner;
  }

  function getCCIPAdmin() public view returns (address) {
      return CCIPAdmin;
  }

  function getCCIPMinter() public view returns (address) {
      return CCIPMinter;
  }

  function getCCIPBurner() public view returns (address) {
      return CCIPBurner;
  }

  modifier onlyCCIPAdmin() {
      _checkCCIPAdmin();
      _;
  }

  modifier onlyCCIPMinter() {
      _checkCCIPMinter();
      _;
  }

  modifier onlyCCIPBurner() {
      _checkCCIPBurner();
      _;
  }

  function _checkCCIPAdmin() internal view {
      if (msg.sender != CCIPAdmin) {
        revert CCIPAdministrable_NotCCIPAdmin(msg.sender);
      }
  }

  function _checkCCIPMinter() internal view {
      if (msg.sender != CCIPMinter) {
        revert CCIPAdministrable_NotCCIPMinter(msg.sender);
      }
  }

  function _checkCCIPBurner() internal view {
      if (msg.sender != CCIPBurner) {
        revert CCIPAdministrable_NotCCIPBurner(msg.sender);
      }
  }
}