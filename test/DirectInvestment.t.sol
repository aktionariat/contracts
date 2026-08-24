// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {DirectInvestment} from "../contracts/investment/DirectInvestment.sol";
import {PaymentHub} from "../contracts/investment/PaymentHub.sol";
import {IDirectInvestment} from "../contracts/investment/IDirectInvestment.sol";

import {IERC20} from "../contracts/ERC20/IERC20.sol";

import {Ownable} from "../contracts/utils/Ownable.sol";

import {MockERC20} from "../contracts/mocks/MockERC20.sol";
import {MockWETH9} from "../contracts/mocks/MockWETH9.sol";
import {MockUniswapV3Quoter, MockUniswapV3Router} from "../contracts/mocks/MockUniswapV3.sol";

import {Test} from "forge-std/Test.sol";

contract PaymentHubTest is Test {
    PaymentHub public hub;
    DirectInvestment public directInvestment;
    MockUniswapV3Quoter public quoter;
    MockUniswapV3Router public router;
    MockWETH9 public weth;
    MockERC20 public shareToken;
    MockERC20 public baseToken;
    MockERC20 public paymentToken;

    address public owner;
    address public buyer;

    uint256 constant PRICE = 100 ether;
    uint256 constant INCREMENT = 0.001 ether;
    uint256 constant INVENTORY = 1_000_000 ether;
    uint256 constant RATE_NUMERATOR = 11;
    uint256 constant RATE_DENOMINATOR = 10;
    uint24 constant FEE = 3000;

    function setUp() public {
        owner = makeAddr("owner");
        buyer = makeAddr("buyer");

        shareToken = new MockERC20("Share", "SHR");
        baseToken = new MockERC20("ZCHF", "ZCHF");
        paymentToken = new MockERC20("EUR", "EUR");
        weth = new MockWETH9();

        quoter = new MockUniswapV3Quoter(RATE_NUMERATOR, RATE_DENOMINATOR, address(weth));
        router = new MockUniswapV3Router(quoter);
        hub = new PaymentHub(owner, quoter, router);

        // mint funds to router
        baseToken.mint(address(router), 1_000_000 ether);

        directInvestment = new DirectInvestment(
            IERC20(address(shareToken)),
            PRICE,
            INCREMENT,
            IERC20(address(baseToken)),
            owner,
            address(hub)
        );
        shareToken.mint(address(directInvestment), INVENTORY);

        // grant router inf allowance to swap tokens
        IERC20[] memory currencies = new IERC20[](2);
        currencies[0] = IERC20(address(paymentToken));
        currencies[1] = IERC20(address(weth));
        hub.approvePaymentCurrencies(currencies);
    }

    // // Utils
    function _path(IERC20 start, IERC20 end, uint256 hops) internal pure returns (bytes memory) {
        bytes memory path = abi.encodePacked(address(start));
        for (uint256 i = 1; i < hops; i++) {
            path = abi.encodePacked(path, FEE, address(end));
        }
        return abi.encodePacked(path, FEE, address(end));
    }

    function _quoteInPaymentCurrency(uint256 priceInBase) internal pure returns (uint256) {
        // price the priceInBase on payment token (saymentToken)
        return (priceInBase * RATE_NUMERATOR + RATE_DENOMINATOR - 1) / RATE_DENOMINATOR;
    }

    // // Tests

    // check path
    function testFuzz_CheckPath_AcceptsValidMultiHopPaths(uint8 seedHops) public {
        uint256 hops = bound(uint256(seedHops), 1, 4);
        bytes memory path = _path(IERC20(address(baseToken)), IERC20(address(paymentToken)), hops);

        assertEq(
            hub.getPriceInPaymentCurrency(directInvestment, 1, IERC20(address(paymentToken)), path),
            _quoteInPaymentCurrency(directInvestment.getBuyPrice(1)),
            "quoted price must flow through the configured rate"
        );
    }

    function testFuzz_CheckPath_RejectsShortPaths(uint8 x) public {
        uint256 len = bound(uint256(x), 0, 42);
        bytes memory path = new bytes(len);
        bytes memory errorOutput = abi.encodeWithSelector(PaymentHub.PaymentHub_InvalidPath.selector, address(directInvestment), address(paymentToken), path);

        // length less than 43 should revert
        vm.expectRevert(errorOutput);
        hub.getPriceInPaymentCurrency(directInvestment, 1, IERC20(address(paymentToken)), path);

        uint256 extra = bound(uint256(x), 1, 22);
        bytes memory path = new bytes(43 + extra);

        // path of length [44, 65] should revert
        vm.expectRevert(errorOutput);
        hub.getPriceInPaymentCurrency(directInvestment, 1, IERC20(address(paymentToken)), path);

        // no base token start
        bytes memory path = _path(IERC20(address(paymentToken)), IERC20(address(paymentToken)), 1);

        vm.expectRevert(errorOutput);
        hub.getPriceInPaymentCurrency(directInvestment, 1, IERC20(address(paymentToken)), path);
        
        // no payment token end
        bytes memory path = _path(IERC20(address(baseToken)), IERC20(address(weth)), 1);

        vm.expectRevert(errorOutput);
        hub.getPriceInPaymentCurrency(directInvestment, 1, IERC20(address(paymentToken)), path);
    }

    // pay from base
    function test_PayFromBaseCurrency_ZeroShares_Reverts() public {
        vm.expectRevert(PaymentHub.PaymentHub_InvalidAmount.selector);
        hub.payFromBaseCurrencyAndNotify(directInvestment, 0, "");
    }

    function testFuzz_PayFromBaseCurrency_BuysAtCurrentPrice(uint256 shares, bytes calldata ref) public {
        shares = bound(shares, 1, 5_000);

        uint256 due = directInvestment.getBuyPrice(shares);
        baseToken.mint(buyer, 2 * due);

        vm.startPrank(buyer);
        baseToken.approve(address(hub), due);
        hub.payFromBaseCurrencyAndNotify(directInvestment, shares, ref);
        vm.stopPrank();

        assertEq(baseToken.balanceOf(buyer), due, "buyer pays exactly the quoted price");
        assertEq(baseToken.balanceOf(address(directInvestment)), due, "direct investment collects the payment");
        assertEq(shareToken.balanceOf(buyer), shares, "buyer receives the shares");
        assertEq(directInvestment.price(), PRICE + shares * INCREMENT, "price bumps after purchase");
    }

    // pay from other currencies
    function testFuzz_PayFromOtherCurrency_RefundsExcess(uint256 shares, uint256 marginSeed) public {
        shares = bound(shares, 1, 5_000);
        uint256 margin = bound(marginSeed, 0, 1e24);

        uint256 dueInBase = directInvestment.getBuyPrice(shares);
        uint256 needed = _quoteInPaymentCurrency(dueInBase);
        uint256 maximum = needed + margin;
        bytes memory path = _path(IERC20(address(baseToken)), IERC20(address(paymentToken)), 1);

        paymentToken.mint(buyer, maximum + 1 ether);
        vm.startPrank(buyer);
        paymentToken.approve(address(hub), maximum);
        hub.payFromOtherCurrencyAndNotify(directInvestment, shares, IERC20(address(paymentToken)), maximum, path, "");
        vm.stopPrank();

        assertEq(paymentToken.balanceOf(buyer), 1 ether + margin, "unused input must be refunded");
        assertEq(paymentToken.balanceOf(address(router)), needed, "router keeps only the swap cost");
        assertEq(baseToken.balanceOf(address(directInvestment)), dueInBase, "swap output settles at the direct investment");
        assertEq(shareToken.balanceOf(buyer), shares, "buyer receives the shares");
    }

    // pay from ether
    function testFuzz_PayFromEther_RefundsExcessAsWeth(uint256 shares, uint256 marginSeed) public {
        shares = bound(shares, 1, 5_000);
        uint256 margin = bound(marginSeed, 1, 1e24);

        uint256 dueInBase = directInvestment.getBuyPrice(shares);
        uint256 needed = _quoteInPaymentCurrency(dueInBase);
        bytes memory path = _path(IERC20(address(baseToken)), IERC20(address(weth)), 1);

        uint256 value = needed + margin;
        vm.deal(buyer, value);
        vm.prank(buyer);
        hub.payFromEtherAndNotify{value: value}(directInvestment, shares, path, "");

        assertEq(buyer.balance, 0, "all ETH is wrapped by the hub");
        assertEq(weth.balanceOf(buyer), margin, "unused ETH is refunded as WETH");
        assertEq(baseToken.balanceOf(address(directInvestment)), dueInBase, "swap output settles at the direct investment");
        assertEq(shareToken.balanceOf(buyer), shares, "buyer receives the shares");
    }

    // multipay
    function testFuzz_MultiPay_PaysEveryRecipient(uint8 seedCount, uint256 paymentAmount) public {
        uint256 count = bound(uint256(seedCount), 1, 5);

        address[] memory recipients = new address[](count);
        uint256[] memory amounts = new uint256[](count);
        uint256 total;
        for (uint256 i = 0; i < count; i++) {
            recipients[i] = address(uint160(i + 1));
            amounts[i] = (i + 1) * paymentAmount;
            total += amounts[i];
        }

        paymentToken.mint(buyer, total);
        vm.startPrank(buyer);
        paymentToken.approve(address(hub), total);
        hub.multiPay(IERC20(address(paymentToken)), recipients, amounts);
        vm.stopPrank();

        for (uint256 i = 0; i < count; i++) {
            assertEq(paymentToken.balanceOf(recipients[i]), (i + 1) * 10 ether, "each recipient must be paid");
        }
    }
}

contract DirectInvestmentTest is Test {
    DirectInvestment public directInvestment;
    MockERC20 public shareToken;
    MockERC20 public baseToken;

    address public owner;
    address public paymentHub;
    address public buyer;

    uint256 constant PRICE = 100 ether;
    uint256 constant INCREMENT = 0.001 ether;
    uint256 constant INVENTORY = 1_000_000 ether;

    function setUp() public {
        owner = makeAddr("owner");
        paymentHub = makeAddr("paymentHub");
        buyer = makeAddr("buyer");

        shareToken = new MockERC20("Share", "SHR");
        baseToken = new MockERC20("ZCHF", "ZCHF");

        directInvestment = new DirectInvestment(
            IERC20(address(shareToken)),
            PRICE,
            INCREMENT,
            IERC20(address(baseToken)),
            owner,
            paymentHub
        );

        shareToken.mint(address(directInvestment), INVENTORY);
    }

    function _newDirectInvestment(uint256 price, uint256 increment) internal returns (DirectInvestment) {
        DirectInvestment di = new DirectInvestment(
            IERC20(address(shareToken)), price, increment,
            IERC20(address(baseToken)), owner, paymentHub
        );
        shareToken.mint(address(di), INVENTORY);
        return di;
    }

    // get buy price
    function testFuzz_GetBuyPrice_Formula(uint256 price, uint256 increment, uint256 shares) public {
        price = bound(price, 0, 1e30);
        increment = bound(increment, 0, 1e21);
        shares = bound(shares, 1, 1e12);

        // fuzz different increment and prices
        DirectInvestment di = _newDirectInvestment(price, increment);

        // naive computation
        uint256 cost = 0;
        for (uint256 i = 0; i < shares; i++) {
            cost += price + i * increment;
        }
        assertEq(di.getBuyPrice(shares), cost, "buy price is computed correctly");
        assertEq(di.getBuyPrice(0), 0, "zero shares must be free");
    }

    // notify trades and transfer
    function testFuzz_NotifyTradeAndTransfer_DeliversShares(uint256 shares, bytes calldata ref) public {
        shares = bound(shares, 1, INVENTORY);

        uint256 newPrice = PRICE + shares * INCREMENT;

        vm.expectEmit(true, false, false, true);
        emit DirectInvestment.Trade(IERC20(address(shareToken)), buyer, ref, shares, IERC20(address(baseToken)), 123, 0, newPrice);

        vm.prank(owner);
        directInvestment.notifyTradeAndTransfer(buyer, shares, 123, ref);

        assertEq(shareToken.balanceOf(buyer), shares, "buyer must receive shares");
        assertEq(directInvestment.price(), newPrice, "price must increase by shares * increment");
    }

    // process incoming
    function testFuzz_ProcessIncoming_DeliveryAndPriceAfterSequentialBuys(uint8 seedRounds, uint256 sharesPerRound) public {
        uint256 rounds = bound(uint256(seedRounds), 1, 10);
        sharesPerRound = bound(sharesPerRound, 1, 100);

        for (uint256 i = 1; i <= rounds; i++) {
            uint256 due = directInvestment.getBuyPrice(sharesPerRound);

            vm.prank(paymentHub);
            directInvestment.processIncoming(buyer, sharesPerRound, due, "");

            assertEq(directInvestment.price(), PRICE + i * sharesPerRound * INCREMENT, "price must track delivered shares");
            assertEq(shareToken.balanceOf(buyer), i * sharesPerRound, "buyer balance must accumulate");
        }
    }

    // withraw only owner
    function testFuzz_Withdraw_OnlyOwner(uint256 amount) public {
        amount = bound(amount, 1, 1e30);
        baseToken.mint(address(directInvestment), amount);
        address recipient = makeAddr("recipient");

        vm.prank(owner);
        directInvestment.withdraw(IERC20(address(baseToken)), recipient, amount);
        assertEq(baseToken.balanceOf(recipient), amount, "owner must rescue tokens");

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(Ownable.Ownable_NotOwner.selector, buyer));
        directInvestment.withdraw(IERC20(address(baseToken)), recipient, 1);
    }
}
