/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* MIT License with Automated License Fee Payments
*
* Copyright (c) 2020 Aktionariat AG (aktionariat.com)
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
pragma solidity ^0.8.0;

import "../shares/Shares.sol";
 import { IL2StandardERC20 } from "../ERC20/IL2StandardERC20.sol";

contract OptimismShares is Shares, IL2StandardERC20 {
    address public l1Token;
    address public l2Bridge;

    constructor(
    address _l2Bridge,
    address _l1Token,
    string memory _symbol,
    string memory _name,
    string memory _terms,
    uint256 _totalShares,
    address _recoveryHub,
    address _owner
    )
      Shares(_symbol, _name, _terms, _totalShares, _owner, _recoveryHub)
    {
      l2Bridge = _l2Bridge;
      l1Token = _l1Token;
    }

    modifier onlyL2Bridge() {
      require(msg.sender == l2Bridge, "Only L2 Bridge can mint and burn");
      _;
    }

    // slither-disable-next-line external-function
    function supportsInterface(bytes4 _interfaceId) public pure override returns (bool) {
        bytes4 firstSupportedInterface = bytes4(keccak256("supportsInterface(bytes4)")); // ERC165
        bytes4 secondSupportedInterface = IL2StandardERC20.l1Token.selector ^
            IL2StandardERC20.mint.selector ^
            IL2StandardERC20.burn.selector;
        return _interfaceId == firstSupportedInterface || _interfaceId == secondSupportedInterface;
    }

    // slither-disable-next-line external-function
    function mint(address _to, uint256 _amount) public virtual override(Shares, IL2StandardERC20) onlyL2Bridge {
        _mint(_to, _amount);

        emit Mint(_to, _amount);
    }

    // slither-disable-next-line external-function
    function burn(address _from, uint256 _amount) public virtual override onlyL2Bridge {
        _burn(_from, _amount);

        emit Burn(_from, _amount);
    }

}