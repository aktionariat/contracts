/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* MIT License with Automated License Fee Payments
*
* Copyright (c) 2021 Aktionariat AG (aktionariat.com)
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

import "../ERC20/ERC20Named.sol";
import "../recovery/ERC20Recoverable.sol";
import "../ERC20/IERC677Receiver.sol";

/**
 * @title CompanyName AG Bonds
 * @author Bernhard Ruf, bernhard@aktionariat.com
 *
 * @notice The main addition is a functionality that allows the user to claim that the key for a certain address is lost.
 * @notice In order to prevent malicious attempts, a collateral needs to be posted.
 * @notice The contract owner can delete claims in case of disputes.
 */
contract Bond is ERC20Recoverable, ERC20Named {

    string public terms;
    uint256 public immutable deployTimestamp; // the timestamp of the contract deployment
    uint256 public immutable termToMaturity; // the duration of the bond

    event Announcement(string message);
    event TermsChanged(string terms);

    constructor(
        string memory _symbol,
        string memory _name,
        string memory _terms,
        uint256 _termToMaturity,
        address _owner,
        IRecoveryHub _recoveryHub
    ) 
        ERC20Named(_symbol, _name, 0, _owner)
        ERC20Recoverable(_recoveryHub)
    {
        symbol = _symbol;
        name = _name;
        terms = _terms;
        // rely on time stamp is ok, no exact time stamp needed
        // solhint-disable-next-line not-rely-on-time
        deployTimestamp = block.timestamp;
        termToMaturity = _termToMaturity;
    }

    function setTerms(string memory _terms) external onlyOwner {
        emit TermsChanged(_terms);
        terms = _terms;
    }

    /**
     * Allows the issuer to make public announcements that are visible on the blockchain.
     */
    function announcement(string calldata message) external onlyOwner() {
        emit Announcement(message);
    }

    /**
     * See parent method for collateral requirements.
     */
    function setCustomClaimCollateral(IERC20 collateral, uint256 rate) external onlyOwner() {
        super._setCustomClaimCollateral(collateral, rate);
    }

    function getClaimDeleter() public override view returns (address) {
        return owner;
    }

    function mint(address target, uint256 amount) external onlyOwner {
        _mint(target, amount);
    }

    function transfer(address to, uint256 value) virtual override(ERC20Recoverable, ERC20Flaggable) public returns (bool) {
        return super.transfer(to, value);
    }

    /**
     * Burns the tokens. Without agreement to the contrary, the legal meaning
     * of this shall be that the sender forfeits all his rights in connection
     * with the burned tokens, rendering them unredeemable.
     */
    function burn(uint256 _amount) external {
        _burn(msg.sender, _amount);
    }

}   
