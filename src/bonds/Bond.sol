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
pragma solidity >=0.8;

import "../ERC20Named.sol";
import "../ERC20Recoverable.sol";
import "../IERC677Receiver.sol";

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
    address bondBot; // addresse of the broker bot which mints/burns
    uint256 immutable maxSupply; // the max inital tokens
    uint256 immutable deployTimestamp; // the timestamp of the contract deployment
    uint256 immutable termToMaturity; // the duration of the bond
    uint256 immutable mintDecrement; // the decrement of the max mintable supply per hour 

    event Announcement(string message);
    event TermsChanged(string terms);
    event BondBotChanged(address bondBot);

    modifier onlyBotAndOwner() {
        require(msg.sender == bondBot || msg.sender == owner, "not bonds bot or owner");
        _;
    }

    constructor(string memory _symbol, string memory _name, string memory _terms, uint256 _maxSupply, uint256 _termToMaturity, uint256 _mintDecrement, address _owner) ERC20Named(_owner, _name, _symbol, 0) {
        symbol = _symbol;
        name = _name;
        terms = _terms;
        maxSupply = _maxSupply;
        deployTimestamp = block.timestamp;
        termToMaturity = _termToMaturity;
        mintDecrement = _mintDecrement;
    }

    function setTerms(string memory _terms) external onlyOwner {
        emit TermsChanged(_terms);
        terms = _terms;
    }

    function setBondBot(address _bondBot) external onlyOwner {
        require(_bondBot != address(0));
        emit BondBotChanged(_bondBot);
        bondBot = _bondBot;
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
    function setCustomClaimCollateral(address collateral, uint256 rate) external onlyOwner() {
        super._setCustomClaimCollateral(collateral, rate);
    }

    function getClaimDeleter() public override view returns (address) {
        return owner;
    }

    function mint(address target, uint256 amount) external onlyBotAndOwner {
        _mint(target, amount);
    }

    function _mint(address account, uint256 amount) internal override {
        require(block.timestamp - deployTimestamp <= termToMaturity, "Bond already reached maturity.");
        require(totalSupply() + amount <= maxMintable(), "Max mintable supply is already minted.");
        super._mint(account, amount);
    }

    function transfer(address to, uint256 value) virtual override(ERC20Recoverable, ERC20) public returns (bool) {
        return super.transfer(to, value);
    }

    function transferAndCall(address recipient, uint amount, bytes calldata data) override(ERC20) external returns (bool) {
        bool success = burn(amount);
        if (success){
            success = IERC677Receiver(recipient).onTokenTransfer(msg.sender, amount, data);
        }
        return success;
    }

    /**
     * Burns the tokens. Without agreement to the contrary, the legal meaning
     * of this shall be that the sender forfeits all his rights in connection
     * with the burned tokens, rendering them unredeemable.
     */
    function burn(uint256 _amount) public returns (bool) {
        require(_amount <= balanceOf(msg.sender), "Not enough bonds available");
        _burn(msg.sender, _amount);
        return true;
    }

    /**
     * Calculates the the maximum ammount which can be minted, which decreses over the time.
     */
    function maxMintable() public view returns (uint256) {
        return maxSupply - (((block.timestamp - deployTimestamp)/ 3600000) * mintDecrement);
    }

}   
