// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2020-2026 Aktionariat AG (aktionariat.com)

pragma solidity 0.8.37;

import "../base/Recoverable.sol";
import "./DragAlong.sol";
import "./Modification.sol";
import "../../ERC20/ERC20Allowlistable.sol";
import "../../ERC20/ERC20Named.sol";

/**
 * @title SharesUnderAgreement
 * @author Luzius Meisser, luzius@aktionariat.com
 * @author Murat Ögat, murat@aktionariat.com
 *
 * This is an ERC-20 token representing share tokens that are bound to
 * a shareholder agreement that can be found at the URL in 'terms'.
 */
contract SharesUnderAgreement is ERC20Named, ERC20Allowlistable, Recoverable, DragAlong, Modification {

    // Version history:
    // 1: pre permit
    // 2: includes permit
    // 3: added permit2 allowance, VERSION field
    // 5 New token standard, skipping 4 to match base security version number
    // 6: assisted unwrap, wrapping mechanics moved to the Wrapping module
    uint8 public constant VERSION = 6;

    /**
     * The url of the terms of this token.
     */
    string public terms;

    /**
     * Indicates whether the terms are binding.
     * 
     * Once the terms cease to be binding, token holders are free to unwrap the token to gain
     * direct possession of the underlying base token. A wrapper never becomes binding again.
     */ 
    bool public binding = true;

    event ChangeTerms(string terms);
    event Terminated();

    constructor(IERC20 base_, string memory _terms, address _owner)
        ERC20Named(string.concat(base_.symbol(), "S"), string.concat(base_.name(), " SHA"), 0, _owner)
        ERC20Allowlistable()
        DeterrenceFee(0.01 ether)
        Wrapping(base_) {
        terms = _terms;
    }

    /**
     * The owner can change the URL where shareholders can find the terms, like on the base token.
     * The URL is a pointer; changing the agreement itself is a Modification subject to the veto period.
     */
    function setTerms(string calldata _terms) external onlyOwner {
        terms = _terms;
        emit ChangeTerms(terms);
    }

    function isBinding() internal view override returns (bool) {
        return binding;
    }

    /**
     * Causes the contract to not be binding any more.
     * 
     * Henceforth, holders will be able to unwrap their tokens to get direct control of the
     * base token. The underlying token might be subject to their own terms. Terminating the
     * terms of this token does not invalidate the terms of underlying tokens.
     */
    function terminate() internal override {
        binding = false;
        emit Terminated();
    }
}
