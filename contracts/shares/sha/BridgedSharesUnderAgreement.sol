// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2020-2026 Aktionariat AG (aktionariat.com)

pragma solidity 0.8.37;

import "../base/Recoverable.sol";
import "../../ERC20/ERC20Allowlistable.sol";
import "../../ERC20/ERC20Named.sol";

/**
 * @title BridgedSharesUnderAgreement
 * @author Murat Ögat, murat@aktionariat.com
 *
 * The representation of a home-chain SharesUnderAgreement on another chain, bridged with Chainlink CCIP:
 * the canonical tokens are locked on the home chain and this token is minted and burned by the CCIP pool.
 * Nothing else mints, so the supply here never exceeds what is locked at home. Wrapping, drag-along and
 * modifications exist on the home chain only; the agreement in 'terms' still governs these tokens.
 */
contract BridgedSharesUnderAgreement is ERC20Named, ERC20Allowlistable, Recoverable {

    // Follows the version of the home-chain SharesUnderAgreement.
    uint8 public constant VERSION = 6;

    string public terms;

    // The CCIP pool, the only minter and burner. Set by the owner once the pool exists.
    address public pool;

    event ChangeTerms(string terms);
    event PoolChanged(address indexed oldPool, address indexed newPool);

    error NotPool(address sender);

    constructor(string memory _symbol, string memory _name, string memory _terms, address _owner)
        ERC20Named(_symbol, _name, 0, _owner)
        ERC20Allowlistable()
        DeterrenceFee(0.01 ether) {
        terms = _terms;
    }

    modifier onlyPool() {
        if (msg.sender != pool) revert NotPool(msg.sender);
        _;
    }

    function setPool(address _pool) external onlyOwner {
        emit PoolChanged(pool, _pool);
        pool = _pool;
    }

    // Called by the pool on arrival of a cross-chain transfer.
    function mint(address account, uint256 amount) external onlyPool {
        _mint(account, amount);
    }

    // Called by the pool when tokens leave this chain; the router has moved them to the pool before.
    // Deliberately burn(uint256) as in BurnMintTokenPool: burn(address,uint256) is the owner's recovery burn.
    function burn(uint256 amount) external onlyPool {
        _burn(msg.sender, amount);
    }

    function setTerms(string calldata _terms) external onlyOwner {
        terms = _terms;
        emit ChangeTerms(_terms);
    }
}
