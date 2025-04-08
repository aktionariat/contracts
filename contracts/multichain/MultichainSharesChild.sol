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

pragma solidity 0.8.29;

import "../recovery/ERC20Recoverable.sol";
import "../ERC20/ERC20PermitLight.sol";
import "../ERC20/ERC20Permit2.sol";
import "./CCIPAdministrable.sol";

contract MultichainSharesChild is ERC20Recoverable, ERC20PermitLight, ERC20Permit2, CCIPAdministrable {

	address private CCIPAdmin;

  constructor(
    string memory _terms,
    IRecoveryHub _recoveryHub,
    address _owner,
    Permit2Hub _permit2Hub,
    address _ccipAdmin
  )
    ERC20Recoverable(_recoveryHub)
    ERC20Permit2(_permit2Hub)
    Ownable(_owner)
    CCIPAdministrable(_ccipAdmin)
  {

  }
}