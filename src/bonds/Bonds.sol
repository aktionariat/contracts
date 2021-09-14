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
 * @title CompanyName AG Shares
 * @author Luzius Meisser, luzius@aktionariat.com
 *
 * These tokens are uncertified shares (Wertrechte according to the Swiss code of obligations),
 * with this smart contract serving as onwership registry (Wertrechtebuch), but not as shareholder
 * registry, which is kept separate and run by the company. This is equivalent to the traditional system
 * of having physical share certificates kept at home by the shareholders and a shareholder registry run by
 * the company. Just like with physical certificates, the owners of the tokens are the owners of the shares.
 * However, in order to exercise their rights (for example receive a dividend), shareholders must register
 * with the company. For example, in case the company pays out a dividend to a previous shareholder because
 * the current shareholder did not register, the company cannot be held liable for paying the dividend to
 * the "wrong" shareholder. In relation to the company, only the registered shareholders count as such.
 * Registration requires setting up an account with ledgy.com providing your name and address and proving
 * ownership over your addresses.
 * @notice The main addition is a functionality that allows the user to claim that the key for a certain address is lost.
 * @notice In order to prevent malicious attempts, a collateral needs to be posted.
 * @notice The contract owner can delete claims in case of disputes.
 */
contract Bonds is ERC20Recoverable, ERC20Named {

    string public terms;
    address bondsBot; // addresse of the broker bot which mints/burns
    uint256 immutable maxMint; // the max mint tokens
    uint256 immutable endAmount; // 
    uint256 immutable deployTimestamp; // the timestamp of the contract deployment
    uint256 duration; // the duration of the bond

    event Announcement(string message);
    event SubRegisterRecognized(address contractAddress);
    event TermsChanged(string terms);
    event BondsBotChanged(address bondsBot);

    modifier onlyBot() {
        require(msg.sender == bondsBot, "not bonds bot");
        _;
    }

    constructor(string memory _symbol, string memory _name, string memory _terms, address _bondsBot, uint256 _maxMint, uint256 _duration, uint256 _endAmount, address owner) ERC20Named(owner, _name, _symbol, 0) {
        symbol = _symbol;
        name = _name;
        terms = _terms;
        bondsBot = _bondsBot;
        maxMint = _maxMint;
        deployTimestamp = block.timestamp;
        duration = _duration;
        endAmount = _endAmount;
    }

    function setTerms(string memory _terms) external onlyOwner {
        emit TermsChanged(_terms);
        terms = _terms;
    }

    function setBondsBot(address _bondsBot) external onlyOwner {
        emit BondsBotChanged(_bondsBot);
        bondsBot = _bondsBot;
    }

    /**
     * Sometimes, tokens are held by other smart contracts that serve as registers themselves. These could
     * be our draggable contract, it could be a bridget to another blockchain, or it could be an address
     * that belongs to a recognized custodian.
     * We assume that the number of sub registers stays limited, such that they are safe to iterate.
     * Subregisters should always have the same number of decimals as the main register and their total
     * balance must not exceed the number of tokens assigned to the subregister.
     * In order to preserve FIFO-rules meaningfully, subregisters should be empty when added or removed.
     */
    function recognizeSubRegister(address contractAddress) public onlyOwner () {
        emit SubRegisterRecognized(contractAddress);
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
    function setCustomClaimCollateral(address collateral, uint256 rate) public onlyOwner() {
        super._setCustomClaimCollateral(collateral, rate);
    }

    function getClaimDeleter() public override view returns (address) {
        return owner;
    }


    /**
     * Allows the company to tokenize shares. If these shares are newly created, setTotalShares must be
     * called first in order to adjust the total number of shares.
     */
    function mintAndCall(address shareholder, address callee, uint256 amount, bytes calldata data) external {
        mint(callee, amount);
        IERC677Receiver(callee).onTokenTransfer(shareholder, amount, data);
    }

    function mint(address target, uint256 amount) public onlyOwner {
        _mint(target, amount);
    }

    function _mint(address account, uint256 amount) internal override {
        require(totalSupply() + amount <= maxMintable(), "There can't be more minted than max mint");
        super._mint(account, amount);
    }

    function transfer(address to, uint256 value) virtual override(ERC20Recoverable, ERC20) public returns (bool) {
        return super.transfer(to, value);
    }

    /**
     * Transfers _amount tokens to the company and burns them.
     * The meaning of this operation depends on the circumstances and the fate of the shares does
     * not necessarily follow the fate of the tokens. For example, the company itself might call
     * this function to implement a formal decision to destroy some of the outstanding shares.
     * Also, this function might be called by an owner to return the shares to the company and
     * get them back in another form under an according agreement (e.g. printed certificates or
     * tokens on a different blockchain). It is not recommended to call this function without
     * having agreed with the company on the further fate of the shares in question.
     */
    function burn(uint256 _amount) public {
        require(_amount <= balanceOf(msg.sender), "Not enough shares available");
        _transfer(msg.sender, address(this), _amount);
        _burn(address(this), _amount);
    }

    function maxMintable() public view returns (uint) {
        return maxMint - ((block.timestamp - deployTimestamp) * duration * (maxMint - endAmount));
    }

}   
