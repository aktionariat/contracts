// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Shares, ISuccessorToken} from "../contracts/shares/base/Shares.sol";
import {ERC20Allowlistable} from "../contracts/ERC20/ERC20Allowlistable.sol";
import {MockSuccessor} from "../contracts/mocks/MockSuccessor.sol";

import {Test} from "forge-std/Test.sol";

contract SharesTest is Test {
    Shares public token;
    address public owner;

    uint256 MAX_BALANCE = type(uint224).max;

    function setUp() public {
        owner = address(0xABCDEF);
        token = new Shares("SYM", "Name", "Terms", owner);
    }

    function testFuzz_MintBurn(uint256 mintAmt, uint256 burnPct) public {
        mintAmt = bound(mintAmt, 1, MAX_BALANCE);
        burnPct = bound(burnPct, 0, mintAmt);

        address holder = makeAddr("holder");
        vm.prank(owner);
        token.mint(holder, mintAmt);

        uint256 toBurn = burnPct / 100;

        vm.prank(holder);
        token.burn(toBurn);

        assertEq(token.balanceOf(holder), mintAmt - toBurn, "balance must equal mint minus burned");
        assertEq(token.totalSupply(), mintAmt - toBurn, "supply must reflect burn");
    }

    function testFuzz_Transfer(uint256 seed) public {
        uint256 amount = bound(seed, 2, MAX_BALANCE);
        address from = makeAddr("from");
        address to = makeAddr("to");

        vm.prank(owner);
        token.mint(from, amount);

        uint256 split = amount / 2;

        vm.prank(from);
        token.transfer(to, split);

        assertEq(token.balanceOf(from), amount - split, "sender balance");
        assertEq(token.balanceOf(to), split, "recipient balance");
        assertEq(token.totalSupply(), amount, "total supply unchanged");
    }

    function testFuzz_ApproveTransferFrom(uint256 seed) public {
        uint256 amount = bound(seed, 1, MAX_BALANCE);
        address holder = makeAddr("holder");
        address spender = makeAddr("spender");
        address recipient = makeAddr("recipient");

        vm.prank(owner);
        token.mint(holder, amount);

        vm.prank(holder);
        token.approve(spender, amount);
        assertEq(token.allowance(holder, spender), amount, "allowance mismatch");

        uint256 half = amount / 2;
        vm.prank(spender);
        token.transferFrom(holder, recipient, half);

        assertEq(token.balanceOf(recipient), half);
        assertEq(token.allowance(holder, spender), amount - half, "allowance decreases");

        // infinite allowance stays infinite
        uint256 infinite = token.INFINITE_ALLOWANCE();
        vm.prank(holder);
        token.approve(spender, infinite);

        vm.prank(spender);
        token.transferFrom(holder, recipient, half);

        assertEq(token.allowance(holder, spender), infinite, "infinite allowance untouched");
    }

    function testFuzz_Pause(uint256 seed) public {
        uint256 amount = bound(seed, 1, 1e36);
        address from = makeAddr("from");
        address to = makeAddr("to");

        vm.prank(owner);
        token.mint(from, amount);

        vm.prank(owner);
        token.pause();

        vm.prank(from);
        vm.expectRevert(ERC20Allowlistable.TransfersPaused.selector);
        token.transfer(to, amount / 2);

        assertEq(token.balanceOf(from), amount, "balance unchanged on revert");

        vm.prank(owner);
        token.unpause();

        vm.prank(from);
        token.transfer(to, amount / 2);
        assertEq(token.balanceOf(to), amount / 2, "transfer works after unpause");
    }

    function testFuzz_Migrate(uint256 seed) public {
        uint256 amount = bound(seed, 1, 1e36);
        address holder = makeAddr("holder");

        MockSuccessor succ = new MockSuccessor("Successor", "SUCCR");
        vm.prank(owner);
        token.setSuccessor(succ);

        vm.prank(owner);
        token.mint(holder, amount);

        vm.prank(holder);
        token.migrate(amount);

        assertEq(token.balanceOf(holder), 0, "holder balance zeroed");
        assertEq(token.totalSupply(), 0, "supply zeroed");
        assertEq(succ.balanceOf(holder), amount, "migrated balance");
    }

    function test_Migrate_NoSuccessor_Reverts() public {
        address holder = makeAddr("holder");
        vm.prank(owner);
        token.mint(holder, 100);

        vm.prank(holder);
        vm.expectRevert(Shares.NoSuccessorDefined.selector);
        token.migrate();
    }

    function testFuzz_RecoveryCycle(uint256 seed) public {
        uint256 amount = bound(seed, 1, MAX_BALANCE);
        address lost = makeAddr("lost");
        address recipient = makeAddr("recipient");

        vm.prank(owner);
        token.mint(lost, amount);

        // owner initiates recovery
        vm.prank(owner);
        token.initRecovery(lost, recipient);

        (address gotRecipient, uint40 ts) = token.recoveries(lost);
        assertEq(gotRecipient, recipient);
        assertTrue(ts != 0, "timestamp set");

        // too early
        vm.expectRevert();
        token.recover(lost);

        // advance time past delay
        vm.warp(block.timestamp + token.RECOVERY_DELAY());

        // anyone can execute
        token.recover(lost);

        assertEq(token.balanceOf(lost), 0, "lost balance zeroed");
        assertEq(token.balanceOf(recipient), amount, "recipient received");
    }

    function test_InitBurn() public {
        address lost = makeAddr("lost");
        uint256 amount = 500;

        vm.prank(owner);
        token.mint(lost, amount);

        vm.prank(owner);
        token.initBurn(lost);

        vm.warp(block.timestamp + token.RECOVERY_DELAY());

        vm.prank(owner);
        token.burn(lost, amount);

        assertEq(token.balanceOf(lost), 0, "balance zeroed");
        assertEq(token.totalSupply(), 0, "supply zeroed");
    }

    function test_OnlyOwner_Reverts() public {
        address random = makeAddr("random");

        vm.prank(random);
        vm.expectRevert();
        token.mint(random, 100);

        vm.prank(random);
        vm.expectRevert();
        token.setTerms("nope");

        vm.prank(random);
        vm.expectRevert();
        token.announcement("nope");
    }
}
