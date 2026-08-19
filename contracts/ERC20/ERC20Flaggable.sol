// SPDX-License-Identifier: MIT
// Copied and adjusted from OpenZeppelin
// Adjustments:
// - modifications to support ERC-677
// - removed unnecessary require statements
// - removed GSN Context
// - upgraded to 0.8 to drop SafeMath
// - let name() and symbol() be implemented by subclass
// - infinite allowance support, with 2^255 and above considered infinite
// - use upper 32 bits of balance for flags
// - add a global settings variable
pragma solidity >=0.8.0 <0.9.0;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "./IERC20.sol";
import "./ERC20Errors.sol";
import "./IERC677Receiver.sol";

/**
 * @dev Implementation of the `IERC20` interface.
 *
 * This implementation is agnostic to the way tokens are created. This means
 * that a supply mechanism has to be added in a derived contract using `_mint`.
 * For a generic mechanism see `ERC20Mintable`.
 *
 * *For a detailed writeup see our guide [How to implement supply
 * mechanisms](https://forum.zeppelin.solutions/t/how-to-implement-erc20-supply-mechanisms/226).*
 *
 * We have followed general OpenZeppelin guidelines: functions revert instead
 * of returning `false` on failure. This behavior is nonetheless conventional
 * and does not conflict with the expectations of ERC20 applications.
 *
 * Additionally, an `Approval` event is emitted on calls to `transferFrom`.
 * This allows applications to reconstruct the allowance for all accounts just
 * by listening to said events. Other implementations of the EIP may not emit
 * these events, as it isn't required by the specification.
 *
 * Finally, the non-standard `decreaseAllowance` and `increaseAllowance`
 * functions have been added to mitigate the well-known issues around setting
 * allowances. See `IERC20.approve`.
 */

abstract contract ERC20Flaggable is Initializable, IERC20, ERC20Errors {
    /// @notice the custom infinite allowance of the ERC20 token
    /// as Documented in /doc/infiniteallowance.md
    /// 0x8000000000000000000000000000000000000000000000000000000000000000
    uint256 public constant INFINITE_ALLOWANCE = 2 ** 255;

    /// @dev the offset needed to be left shifted to reach flag's bits
    uint8 private constant FLAGGING_OFFSET = 224;
    /// @dev the mask to select flags bits
    uint256 private constant FLAGGING_MASK = (type(uint256).max) << FLAGGING_OFFSET;
    /// @dev the maximum offset allowed
    /// if FLAGGING_OFFSET is not greater or equal to 1, uint8 overflows and
    /// it correctly diqualifies any offset
    uint8 private constant MAX_FLAGGING_OFFSET = uint8(256 - FLAGGING_OFFSET);

    /**
     * FLAGs
     * Documentation of flags used by subclasses.
     * 
     * 
     * @dev Internal flags are bit flags: it can hold 32 true/false flags and additional zero flag representation.
     *      Intenral flag indexes can range from 0 up to and including 31.
     *      Internal flags are managed on the account's balance, within the _balances map.
     * 
     * ERC20Draggable: uint8 private constant FLAG_INDEX_VOTED = 1;
     * ERC20Recoverable: uint8 private constant FLAG_INDEX_CLAIM_PRESENT = 10;
     * ERCAllowlistable: uint8 private constant FLAG_INDEX_ALLOWLIST = 20;
     * ERCAllowlistable: uint8 private constant FLAG_INDEX_FORBIDDEN = 21;
     * ERCAllowlistable: uint8 private constant FLAG_INDEX_POWERLIST = 22;
     * 
     * 
     * @dev Global flags are bit flags: it can hold 256 true/false flags and additional zero flag representation.
     *      Global flag indexes can range from 0 up to and including 255.
     *      Global flags are managed by _settings.
     * 
     * ERCAllowlistable: uint8 private constant GLOBAL_FLAG_INDEX_PAUSED = 100;
     * 
     * @notice can be turned into a standalone library
     */

    /// @dev balances map: owner => token quantity
    mapping(address => uint256) private _balances; // upper 32 bits reserved for flags
    /// @dev allowance map: owner => allowed address => token quantity
    mapping(address => mapping(address => uint256)) private _allowances;

    /// @dev token global settings
    uint256 private _settings;
    /// @dev token total supply
    uint256 private _totalSupply;

    /// @notice token decimals
    uint8 public override decimals;


    /// Overflow on internal flag offset
    /// @param offset the offset used
    /// @param maxOffset the maximum valid offset
    error InvalidFlagOffset(uint8 offset, uint8 maxOffset);

    constructor(uint8 _decimals) {
        decimals = _decimals;
    }

    /**
     * Proxy constructor.
     *
     * @param _decimals token decimals
     */
    function __ERC20Flaggable_init(uint8 _decimals) internal onlyInitializing {
        decimals = _decimals;
    }

    /**
     * @dev See `IERC20.totalSupply`.
     */
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See `IERC20.balanceOf`.
     */
    function balanceOf(address account) public view override returns (uint256) {
        return uint224(_balances[account]);
    }

    /**
     * Queries whether a specific account has a specific flag.
     * 
     * @param account the address to be queried for the flag
     * @param number the index offset to select the flag
     */
    function hasFlag(address account, uint8 number) external view returns (bool) {
        return _hasFlag(account, number);
    }

    /**
     * Queries whether a specific account has a specific flag.
     * 
     * @param account the address to be queried
     * @param index the index offset to select the flag (from 0 up to inlcuding 31)
     * @return bool whether the address has the flag set or not
     */
    function _hasFlag(address account, uint8 index) internal view returns (bool) {
        // ensure index is within bounds
        if (MAX_FLAGGING_OFFSET <= index) {
            revert InvalidFlagOffset(index, MAX_FLAGGING_OFFSET);
        }

        uint256 flag = 0x1 << (index + FLAGGING_OFFSET);
        return _balances[account] & flag == flag;
    }

    /**
     * Applies a flag to an address
     * 
     * @param account the address to apply the flag to
     * @param index the offset index of the flag
     * @param value whether the flag has to be applied or removed, ture or false respectively
     */
    function _setFlag(address account, uint8 index, bool value) internal {
        // ensure index is within bounds
        if (MAX_FLAGGING_OFFSET <= index) {
            revert InvalidFlagOffset(index, MAX_FLAGGING_OFFSET);
        }

        uint256 flagMask = 1 << (index + FLAGGING_OFFSET);
        uint256 balance = _balances[account];
        if ((balance & flagMask == flagMask) != value) {
            _balances[account] = balance ^ flagMask;
        }
    }

    /**
     * Queries if the gloabl flag at the specific index is set,
     * 
     * @param index the index of the flag
     * @return bool to indicate whether or not the flag is set
     */
    function _hasGlobalFlag(uint8 index) internal view returns (bool) {
        uint256 flagMask = 1 << index;
        return (_settings & flagMask) == flagMask;
    }

    /**
     * Applies a global flag.
     * 
     * @param index the index of the flag to be modified
     * @param value whether to add or remove the flag, respectively, true and false
     */
    function _setGlobalFlag(uint8 index, bool value) internal {
        uint256 flagMask = 1 << index;
        if ((_settings & flagMask == flagMask) != value) {
            _settings = _settings ^ flagMask;
        }
    }

    /**
     * @dev See `IERC20.transfer`.
     *
     * Requirements:
     *
     * - `recipient` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    /**
     * @dev See `IERC20.allowance`.
     */
    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev See `IERC20.approve`.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 value) external override returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    /**
     * @dev See `IERC20.transferFrom`.
     *
     * Emits an `Approval` event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of `ERC20`;
     *
     * Requirements:
     * - `sender` and `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `value`.
     * - the caller must have allowance for `sender`'s tokens of at least
     * `amount`.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        _transfer(sender, recipient, amount);

        uint256 currentAllowance = allowance(sender, msg.sender);
        if (currentAllowance < INFINITE_ALLOWANCE) {
            // Only decrease the allowance if it was not set to 'infinite'
            // Documented in /doc/infiniteallowance.md
            _allowances[sender][msg.sender] = currentAllowance - amount;
        }

        return true;
    }

    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to `transfer`, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a `Transfer` event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(address sender, address recipient, uint256 amount) internal virtual {
        _beforeTokenTransfer(sender, recipient, amount);

        decreaseBalance(sender, amount);
        increaseBalance(recipient, amount);
        emit Transfer(sender, recipient, amount);
    }

    // ERC-677 functionality, can be useful for swapping and wrapping tokens
    function transferAndCall(address recipient, uint amount, bytes calldata data) external virtual returns (bool) {
        return transfer(recipient, amount) && IERC677Receiver(recipient).onTokenTransfer(msg.sender, amount, data);
    }

    /**
     * @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a `Transfer` event with `from` set to the zero address.
     *
     * Requirements
     *
     * - `to` cannot be the zero address.
     */
    function _mint(address recipient, uint256 amount) internal virtual {
        _beforeTokenTransfer(address(0), recipient, amount);

        _totalSupply += amount;
        increaseBalance(recipient, amount);
        emit Transfer(address(0), recipient, amount);
    }

    /**
     * Increases the balance of an address by a specific amount
     * 
     * @param recipient the address which balance to increase
     * @param amount the amount to be increased by
     */
    function increaseBalance(address recipient, uint256 amount) private {
        if (recipient == address(0x0)) {
            revert ERC20InvalidReceiver(recipient); // use burn instead
        }

        uint256 oldBalance = _balances[recipient];
        uint256 newBalance = oldBalance + amount;

        _checkAllowlistingFlagUnchanged(oldBalance, newBalance, recipient, amount);

        _balances[recipient] = newBalance;
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a `Transfer` event with `to` set to the zero address.
     *
     * Requirements
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(address account, uint256 amount) internal virtual {
        _beforeTokenTransfer(account, address(0), amount);

        _totalSupply -= amount;
        decreaseBalance(account, amount);
        emit Transfer(account, address(0), amount);
    }

    /**
     * Decreases the balance of an address by a specific amount
     * 
     * @param sender the address which balance to decrease
     * @param amount the amount to be decreased by
     */
    function decreaseBalance(address sender, uint256 amount) private {
        uint256 oldBalance = _balances[sender];
        uint256 newBalance = oldBalance - amount;

        _checkAllowlistingFlagUnchanged(oldBalance, newBalance, sender, amount);

        _balances[sender] = newBalance;
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner`s tokens.
     *
     * This is internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an `Approval` event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(address owner, address spender, uint256 value) internal {
        _allowances[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    /**
     * @dev Hook that is called before any transfer of tokens. This includes
     * minting and burning.
     *
     * Calling conditions:
     *
     * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens will be to transferred to `to`.
     * - when `from` is zero, `amount` tokens will be minted for `to`.
     * - when `to` is zero, `amount` of ``from``'s tokens will be burned.
     * - `from` and `to` are never both zero.
     *
     * This function is intentionally left blank. By default ERC20Flaggable does not take any actions on its own,
     * but derived contracts may override it to implement custom logic. For example, allowlisting.
     */

    // solhint-disable-next-line no-empty-blocks
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual;

    /**
     * Checks that allowlist flag remains unchanged, that is, the balance does not overflow nor
     * underflow from available unit224 space.
     * 
     * @dev it could be that the balance is reduced while not being under 0x0 allowlist tier (free).
     *      In that case if the balance of the user is zero and he tries to burn tokens he will be
     *      allowed if the allowlisting flag is not validated, as virtually he doesn't have a zero
     *      balance.
     * 
     * @param oldBalance old user balance
     * @param newBalance new user balance
     * @param owner sender address
     * @param amount balance amount change
     */
    function _checkAllowlistingFlagUnchanged(uint256 oldBalance, uint256 newBalance, address owner, uint256 amount) internal view {
        if (oldBalance & FLAGGING_MASK != newBalance & FLAGGING_MASK) {
            // assume more meaning for the current code than simply insufficient balance
            revert ERC20InsufficientBalance(owner, balanceOf(owner), amount);
        }
    }

    /**
     * Checks if msg.sender is an authorized address.
     * @param validSender The authorized address.
     */
    function _checkSender(address validSender) internal view {
        if (msg.sender != validSender) {
            revert ERC20InvalidSender(msg.sender);
        }
    }
}
