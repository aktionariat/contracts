/**
 * SPDX-License-Identifier: LicenseRef-Aktionariat
 *
 * MIT License with Automated License Fee Payments
 *
 * Copyright (c) 2026 Aktionariat AG (aktionariat.com)
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

import "../shares/base/Recoverable.sol";
import "../ERC20/ERC20Allowlistable.sol";
import "../ERC20/ERC20Named.sol";

/**
 * @title Bridged CompanyName AG Shares SHA
 * @author Murat Ögat, murat@aktionariat.com
 *
 * The remote-chain representation of a home-chain SharesUnderAgreement token, bridged via
 * Chainlink CCIP using the lock-and-mint topology: on the home chain the canonical tokens are
 * locked in a LockReleaseTokenPool, and on each remote chain this contract is minted and burned
 * by a BurnMintTokenPool.
 *
 * This is deliberately NOT a SharesUnderAgreement. The home token is a wrapper whose value derives
 * from custody of a base token on its own chain (wrap/unwrap, drag-along, terms modification). None
 * of that backing exists on a remote chain, so this contract carries none of it. Its supply is
 * controlled exclusively by the CCIP pool and therefore always equals the amount of canonical tokens
 * locked in the home-chain pool. The shareholder agreement still governs these tokens; 'terms' links
 * to it, but governance actions are executed on the home chain only.
 */
contract BridgedSharesUnderAgreement is ERC20Named, ERC20Allowlistable, Recoverable {

    // Matches the security version number of the home-chain token family.
    uint8 public constant VERSION = 5;

    /**
     * The url of the terms of this token, identical to the home-chain SharesUnderAgreement.
     */
    string public terms;

    /**
     * The CCIP token pool authorised to mint and burn this token. Set by the owner after the pool
     * has been deployed and registered with the CCIP TokenAdminRegistry. There is no other minting
     * authority: not even the owner can mint, which is what keeps the remote supply pegged to the
     * amount locked on the home chain.
     */
    address public pool;

    event PoolChanged(address indexed oldPool, address indexed newPool);
    event ChangeTerms(string terms);

    error NotPool(address sender);

    constructor(string memory _symbol, string memory _name, string memory _terms, address _owner)
        ERC20Named(_symbol, _name, 0, _owner) // decimals are always 0, like the home-chain shares
        ERC20Allowlistable()
        DeterrenceFee(0.01 ether) {
        terms = _terms;
    }

    /**
     * Allow only the registered CCIP token pool to call a function.
     */
    modifier onlyPool() {
        if (msg.sender != pool) revert NotPool(msg.sender);
        _;
    }

    /**
     * Sets the CCIP token pool that is allowed to mint and burn this token.
     *
     * Must be called after the pool is deployed and registered. Changing the pool migrates the
     * mint/burn authority; the old pool can no longer mint or burn afterwards.
     */
    function setPool(address _pool) external onlyOwner {
        emit PoolChanged(pool, _pool);
        pool = _pool;
    }

    /**
     * Mints tokens on arrival of a cross-chain transfer.
     *
     * Called by the CCIP pool during release-or-mint. Deliberately restricted to the pool so that
     * the total supply can never exceed the amount of canonical tokens locked on the home chain.
     */
    function mint(address account, uint256 amount) external onlyPool {
        _mint(account, amount);
    }

    /**
     * Burns tokens that are being bridged out of this chain.
     *
     * Called by the CCIP pool during lock-or-burn. The router transfers the tokens to the pool
     * before this call, so the pool burns its own balance. This matches the standard
     * BurnMintTokenPool, which calls burn(uint256); do not use the BurnWithFromMintTokenPool, whose
     * burn(address, uint256) collides with the owner-gated recovery burn inherited from Recoverable.
     */
    function burn(uint256 amount) external onlyPool {
        _burn(msg.sender, amount);
    }

    /**
     * The owner can change the URL where shareholders can find the terms, in line with the home token.
     */
    function setTerms(string calldata _terms) external onlyOwner {
        terms = _terms;
        emit ChangeTerms(_terms);
    }

}
