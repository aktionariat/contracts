// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {ERC20Allowlistable} from "../contracts/ERC20/ERC20Allowlistable.sol";
import {ERC20Named} from "../contracts/ERC20/ERC20Named.sol";
import {IERC20} from "../contracts/ERC20/IERC20.sol";

import {Test} from "forge-std/Test.sol";

/// @notice Concrete token that exposes internal functions for testing the allowlist state matrix.
contract AllowlistToken is ERC20Named, ERC20Allowlistable {
    constructor() ERC20Named("TEST", "Test Token", 0, msg.sender) {}

    /// @dev basic utils externalized

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    function forceTransfer(address from, address to, uint256 amount) external {
        _transfer(from, to, amount);
    }
}

contract AllowlistTest is Test {
    AllowlistToken public token;
    address public owner;

    // // Utils

    function setUp() public {
        owner = address(this);
        token = new AllowlistToken();
    }

    function isFree(AllowlistToken t, address a) internal view returns (bool) {
        return !t.isAllowed(a) && !t.isRestricted(a) && !t.isAdmin(a);
    }

    function getAmountAndSingle(uint256 x) internal pure returns (uint256 amount, uint256 single) {
        amount = bound(x, 0, type(uint224).max);
        single = x < 4 ? 0 : 1;
    }

    function prepareAddresses() internal returns(address, address, address, address) {
        address free = address(0x58302);
        require(isFree(token, free), "[prepareAddresses] Not FREE Address");

        address allowed = address(0xFFAB56);
        token.setType(allowed, token.TYPE_ALLOWED());
        require(token.isAllowed(allowed), "[prepareAddresses] Not ALLOWED Address");

        address restricted = address(0xCCFFB8);
        token.setType(restricted, token.TYPE_RESTRICTED());
        require(token.isRestricted(restricted), "[prepareAddresses] Not RESTRICTED Address");

        address admin = address(0xCC2244);
        token.setType(admin, token.TYPE_ADMIN());
        require(token.isAdmin(admin), "[prepareAddresses] Not ADMIN Address");

        return (free, allowed, restricted, admin);
    }

    // // Tests

    // test zero-transfer invariant
    function test_AdminTransfer_ZeroAmount_DoesNotAllowlist() public {
        address admin = address(0xA);
        address recipient = address(0xB);

        // free recipient
        require(isFree(token, recipient), "receipient not free");

        token.setType(admin, token.TYPE_ADMIN());
        token.forceTransfer(admin, recipient, 0);

        require(!token.isAllowed(recipient) && isFree(token, recipient), "zero-amount admin transfer must not auto-allowlist");
    }

    // pause unpause
    function test_PauseUnpauseTransfers(uint256 x) public {
        uint256 amount = bound(x, 1, type(uint224).max);
        address from = address(0xA);
        address to = address(0xB);
        token.mint(from, amount);

        token.pause();

        try token.forceTransfer(from, to, amount) {
            revert("transfer must revert when paused");
        } catch {
            // Expected
        }

        token.unpause();

        token.forceTransfer(from, to, amount);
        require(token.balanceOf(to) == amount, "transfer must succeed after unpause");
    }

    // defaultType
    function testFuzz_DefaultType_WhenAdminNotSet(uint256 x) public {
        require(token.defaultType() == token.TYPE_FREE(), "defaultType should be FREE (0)");

        bool toSetAllowlist = x % 2 == 0;
        token.setApplicable(toSetAllowlist);

        require(
            toSetAllowlist ? token.defaultType() == token.TYPE_ALLOWED() : token.defaultType() == token.TYPE_FREE(),
            toSetAllowlist ? "defaultType should be ALLOWED" : "defaultType should be FREE"
        );
    }

    function testFuzz_SetType_ExactlyOneFlag(uint8 typeNum) public {
        typeNum = uint8(bound(typeNum, 1, 4));
        if (
            typeNum != token.TYPE_ALLOWED() &&
            typeNum != token.TYPE_RESTRICTED() &&
            typeNum != token.TYPE_ADMIN()
        ) return;

        address addr = address(0);
        token.setType(addr, typeNum);

        require(token.isAllowed(addr) == (typeNum == token.TYPE_ALLOWED()), "Not ALLOWED flag");
        require(token.isRestricted(addr) == (typeNum == token.TYPE_RESTRICTED()), "Not RESTRICTED flag");
        require(token.isAdmin(addr) == (typeNum == token.TYPE_ADMIN()), "Not ADMIN flag");
    }

    function testFuzz_SetType_FreeClearsFlags(uint256 typeChoice) public {
        uint8 u8_typeChoice = uint8(bound(typeChoice, 0, 10));
        address addr = address(0);

        if (u8_typeChoice == token.TYPE_ALLOWED()) {
            token.setType(addr, token.TYPE_ALLOWED());
            require(token.isAllowed(addr), "Not ALLOWED Address");
        } else if (u8_typeChoice == token.TYPE_RESTRICTED()) {
            token.setType(addr, token.TYPE_RESTRICTED());
            require(token.isRestricted(addr), "Not RESTRICTED Address");
        } else if (u8_typeChoice == token.TYPE_ADMIN()) {
            token.setType(addr, token.TYPE_ADMIN());
            require(token.isAdmin(addr), "Not ADMIN Address");
        } else {
            token.setType(addr, u8_typeChoice);
            require(isFree(token, addr), "Not FREE Address");
        }

        token.setType(addr, token.TYPE_FREE()); // FREE
        require(isFree(token, addr), "FREE must clear ALLOWED, RESTRICTED and ADMIN");
    }

    // From:
    // +------------+-----+-----+-----+-----+
    // |            | Fre | Alw | Res | Adm |
    // +------------+-----+-----+-----+-----+
    // | Free       |  Y  |  Y  |  N  |  Y  |
    // | Allowed    |  N  |  Y  |  N  |  Y  |
    // | Restricted |  N  |  N  |  N  |  Y  |
    // | Admin      |  Y  |  Y  |  N  |  Y  |
    // +------------+-----+-----+-----+-----+

    function testFuzz_Transfer_FreeToAny(uint256 x) public {
        (uint256 amount, uint256 single) = getAmountAndSingle(x);

        address from = address(0xA);
        token.mint(from, amount);

        (address toFree, address toAllowed, address toRestricted, address toAdmin) = prepareAddresses();

        token.forceTransfer(from, toFree, single);
        require(token.balanceOf(toFree) == single, "free to free must transfer");

        token.forceTransfer(from, toAllowed, single);
        require(token.balanceOf(toAllowed) == single, "free to allowed must transfer");

        try token.forceTransfer(from, toRestricted, single) {
            revert("free to restricted should revert");
        } catch {
            //
        }

        token.forceTransfer(from, toAdmin, single);
        require(token.balanceOf(toAdmin) == single, "free to admin must transfer");
    }

    function testFuzz_Transfer_AllowedToAny(uint256 x) public {
        (uint256 amount, uint256 single) = getAmountAndSingle(x);

        address from = address(0xA);
        token.mint(from, amount);
        token.setType(from, token.TYPE_ALLOWED());
        require(token.isAllowed(from), "Not ALLOWED Address");

        (address toFree, address toAllowed, address toRestricted, address toAdmin) = prepareAddresses();

        try token.forceTransfer(from, toFree, single) {
            revert("allowed to free should revert");
        } catch {
            // Expected
        }

        token.forceTransfer(from, toAllowed, single);
        require(token.balanceOf(toAllowed) == single, "allowed to allowed must transfer");

        try token.forceTransfer(from, toRestricted, single) {
            revert("allowed to restricted should revert");
        } catch {
            // Expected
        }

        token.forceTransfer(from, toAdmin, single);
        require(token.balanceOf(toAdmin) == single, "allowed to admin must transfer");
    }

    function testFuzz_Transfer_RestrictedToAny(uint256 x) public {
        (uint256 amount, uint256 single) = getAmountAndSingle(x);

        address from = address(0xA);
        token.mint(from, amount);
        token.setType(from, token.TYPE_RESTRICTED());
        require(token.isRestricted(from), "Not RESTRICTED Address");

        (address toFree, address toAllowed, address toRestricted, address toAdmin) = prepareAddresses();

        try token.forceTransfer(from, toFree, amount) {
            revert("restricted to free should revert");
        } catch {
            // Expected
        }

        try token.forceTransfer(from, toAllowed, amount) {
            revert("restricted to allowed should revert");
        } catch {
            // Expected
        }

        try token.forceTransfer(from, toRestricted, amount) {
            revert("restricted to restricted should revert");
        } catch {
            // Expected
        }

        token.forceTransfer(from, toAdmin, single);
        require(token.balanceOf(toAdmin) == single, "restricted to admin must transfer");
    }

    // tests also auto-allowlist
    function testFuzz_Transfer_AdminToAny(uint256 x) public {
        (uint256 amount, uint256 single) = getAmountAndSingle(x);

        address from = address(0xA);
        token.mint(from, amount);
        token.setType(from, token.TYPE_ADMIN());
        require(token.isAdmin(from), "Not ADMIN Address");

        (address toFree, address toAllowed, address toRestricted, address toAdmin) = prepareAddresses();

        token.forceTransfer(from, toFree, single);
        require(token.balanceOf(toFree) == single, "admin to free must transfer");
        require(single == 0 ? isFree(token, toFree) : token.isAllowed(toFree), "admin to free must set free as ALLOWED if non-zero transfer");


        token.forceTransfer(from, toAllowed, single);
        require(token.balanceOf(toAllowed) == single, "admin to allowed must transfer");

        try token.forceTransfer(from, toRestricted, single) {
            revert("to restricted must always revert");
        } catch {
            // Expected
        }

        token.forceTransfer(from, toAdmin, single);
        require(token.balanceOf(toAdmin) == single, "admin to admin must transfer");
        require(token.isAdmin(toAdmin), "admin to must remain ADMIN");
    }
}
