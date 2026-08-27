// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Shares} from "../contracts/shares/base/Shares.sol";
import {SharesUnderAgreement} from "../contracts/shares/sha/SharesUnderAgreement.sol";
import {ERC20Allowlistable} from "../contracts/ERC20/ERC20Allowlistable.sol";
import {IERC20} from "../contracts/ERC20/IERC20.sol";

import {Test} from "forge-std/Test.sol";

contract SharesUnderAgreementTest is Test {
    SharesUnderAgreement public sha;
    Shares public base;
    address public owner;

    uint256 MAX_BALANCE = type(uint224).max;

    function setUp() public {
        owner = makeAddr("owner");
        base = new Shares("Base", "BASE", "terms", owner);
        sha = new SharesUnderAgreement(IERC20(address(base)), "https://terms.example.com", base.decimals(), owner);
    }

    // wrap

    function testFuzz_Wrap(uint256 seed) public {
        uint256 amount = bound(seed, 1, MAX_BALANCE);

        vm.startPrank(owner);
        base.mint(owner, amount);
        base.approve(address(sha), amount);
        sha.wrap(amount);
        vm.stopPrank();

        assertEq(sha.balanceOf(owner), amount, "SHA balance must equal wrapped amount");
        assertEq(base.balanceOf(owner), 0, "base balance must be zero");
        assertEq(base.balanceOf(address(sha)), amount, "SHA contract must hold base tokens");
        assertEq(sha.totalSupply(), amount, "total supply must equal wrapped");
    }

    function testFuzz_WrapToRecipient(uint256 seed) public {
        uint256 amount = bound(seed, 1, MAX_BALANCE);
        address sender = makeAddr("sender");
        address recipient = makeAddr("recipient");

        vm.prank(owner);
        base.mint(sender, amount);

        vm.startPrank(sender);
        base.approve(address(sha), amount);
        sha.wrap(recipient, amount);

        assertEq(sha.balanceOf(recipient), amount, "recipient gets SHA tokens");
        assertEq(sha.balanceOf(sender), 0, "sender gets nothing");
        vm.stopPrank();
    }

    function test_WrapRevertsWhenInsufficientBalance() public {
        address holder = makeAddr("holder");

        vm.prank(owner);
        base.mint(holder, 50);

        vm.startPrank(holder);
        base.approve(address(sha), 100);
        vm.expectRevert();
        sha.wrap(100);
        vm.stopPrank();
    }

    function testFuzz_ConvertToBase(uint256 wrapAmt, uint256 extraDeposit) public {
        wrapAmt = bound(wrapAmt, 1, 1e18);
        extraDeposit = bound(extraDeposit, 0, 1e18);

        address holder = makeAddr("holder");
        address holder2 = makeAddr("donor");

        // wrap some tokens
        vm.prank(owner);
        base.mint(holder, wrapAmt);
        vm.startPrank(holder);
        base.approve(address(sha), wrapAmt);
        sha.wrap(wrapAmt);
        vm.stopPrank();

        // wrap extra tokens a second time
        vm.prank(owner);
        base.mint(holder2, extraDeposit);
        vm.prank(holder2);
        base.approve(address(sha), extraDeposit);
        vm.prank(holder2);
        sha.wrap(extraDeposit);

        // convertToBase should return the wrapped amount since no burn happened
        uint256 converted = sha.convertToBase(wrapAmt);
        assertEq(converted, wrapAmt, "convertToBase math mismatch");
        // such amount changes in case SHA tokens are burned
    }

    // transfer

    function testFuzz_Transfer(uint256 seed) public {
        uint256 amount = bound(seed, 2, MAX_BALANCE);
        address from = makeAddr("from");
        address to = makeAddr("to");

        vm.prank(owner);
        base.mintAndWrap(from, address(sha), amount);
        vm.startPrank(from);

        uint256 split = amount / 2;
        sha.transfer(to, split);

        assertEq(sha.balanceOf(from), amount - split, "sender balance");
        assertEq(sha.balanceOf(to), split, "recipient balance");
        assertEq(sha.totalSupply(), amount, "total supply unchanged");
        vm.stopPrank();
    }


    function testFuzz_ApproveTransferFrom(uint256 seed) public {
        uint256 amount = bound(seed, 1, MAX_BALANCE);
        address holder = makeAddr("holder");
        address spender = makeAddr("spender");
        address recipient = makeAddr("recipient");

        vm.prank(owner);
        base.mint(holder, amount);
        vm.startPrank(holder);
        base.approve(address(sha), amount);
        sha.wrap(amount);

        sha.approve(spender, amount);
        assertEq(sha.allowance(holder, spender), amount, "allowance mismatch");

        uint256 half = amount / 2;
        vm.stopPrank();

        vm.prank(spender);
        sha.transferFrom(holder, recipient, half);

        assertEq(sha.balanceOf(recipient), half, "recipient balance");
        assertEq(sha.allowance(holder, spender), amount - half, "allowance decreases");

        // infinite allowance stays infinite
        uint256 infinite = sha.INFINITE_ALLOWANCE();
        vm.prank(holder);
        sha.approve(spender, infinite);

        vm.prank(spender);
        sha.transferFrom(holder, recipient, half);

        assertEq(sha.allowance(holder, spender), infinite, "infinite allowance untouched");
    }

    // pause

    function testFuzz_Pause(uint256 seed) public {
        uint256 amount = bound(seed, 1, 1e36);
        address from = makeAddr("from");
        address to = makeAddr("to");

        vm.prank(owner);
        base.mint(from, amount);
        vm.startPrank(from);
        base.approve(address(sha), amount);
        sha.wrap(amount);
        vm.stopPrank();

        vm.prank(owner);
        sha.pause();

        vm.prank(from);
        vm.expectRevert(ERC20Allowlistable.TransfersPaused.selector);
        sha.transfer(to, amount / 2);

        assertEq(sha.balanceOf(from), amount, "balance unchanged on revert");

        vm.prank(owner);
        sha.unpause();

        vm.prank(from);
        sha.transfer(to, amount / 2);
        assertEq(sha.balanceOf(to), amount / 2, "transfer works after unpause");
    }

    // binding
    function test_UnwrapRevertsWhenBinding() public {
        assertTrue(sha.binding(), "starts binding");

        address holder = makeAddr("holder");
        vm.prank(owner);
        base.mint(holder, 100);

        vm.startPrank(holder);
        base.approve(address(sha), 100);
        sha.wrap(100);

        vm.expectRevert(SharesUnderAgreement.ContractBinding.selector);
        sha.unwrap(100);
        vm.stopPrank();
    }

    function test_UnwrapSucceedsWhenNotBinding() public {
        address holder = makeAddr("holder");
        uint256 amount = 100;

        vm.prank(owner);
        base.mint(holder, amount);
        vm.startPrank(holder);
        base.approve(address(sha), amount);
        sha.wrap(amount);
        vm.stopPrank();

        vm.prank(owner);
        sha.proposeTermination();

        vm.warp(block.timestamp + sha.MIGRATION_PROPOSAL_DELAY());

        sha.executeMigration();

        assertFalse(sha.binding(), "should not be binding after termination");

        vm.prank(holder);
        sha.unwrap(amount);

        assertEq(sha.balanceOf(holder), 0, "SHA balance zeroed after unwrap");
        assertEq(base.balanceOf(holder), amount, "base tokens returned");
    }
}
