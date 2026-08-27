// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {SecondaryMarket} from "../contracts/market/SecondaryMarket.sol";
import {TradeReactor} from "../contracts/market/TradeReactor.sol";
import {Intent, IntentHash} from "../contracts/market/IntentHash.sol";
import {MockERC20} from "../contracts/mocks/MockERC20.sol";

import {Test} from "forge-std/Test.sol";

contract SecondaryMarketTest is Test {
    using IntentHash for Intent;

    TradeReactor public reactor;
    SecondaryMarket public market;
    MockERC20 public currency;
    MockERC20 public token;

    address public owner;
    address public seller;
    address public buyer;

    uint256 sellerKey = 0xA11CE;
    uint256 buyerKey = 0xB0B;

    uint256 MAX_TOKEN_AMOUNT = 1e36;

    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"
    );
    bytes32 private constant NAME_HASH = keccak256("TradeIntent");
    bytes32 private constant VERSION_HASH = keccak256("1");
    bytes32 private constant SALT = keccak256("aktionariat");

    function setUp() public {
        owner = makeAddr("owner");
        seller = vm.addr(sellerKey);
        buyer = vm.addr(buyerKey);

        currency = new MockERC20("USD", "USD");
        token = new MockERC20("ABC", "ABC");

        reactor = new TradeReactor();
        market = new SecondaryMarket(owner, address(currency), address(token), address(reactor), address(0));
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(reactor), SALT));
    }

    function _signIntent(uint256 privateKey, Intent memory intent) internal view returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), market.getIntentHash(intent)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _sellIntent(uint256 tokensOffered, uint256 currencyWanted, uint24 validity) internal view returns (Intent memory) {
        return Intent(seller, address(market), address(token), tokensOffered, address(currency), currencyWanted, block.timestamp, block.timestamp + validity, new bytes(0));
    }

    function _buyIntent(uint256 currencyOffered, uint256 tokensWanted, uint24 validity) internal view returns (Intent memory) {
        return Intent(buyer, address(market), address(currency), currencyOffered, address(token), tokensWanted, block.timestamp, block.timestamp + validity, new bytes(0));
    }

    function _intent(uint256 amountOut, uint256 amountIn) internal pure returns (Intent memory) {
        return Intent(address(0), address(0), address(0), amountOut, address(0), amountIn, 0, 0, new bytes(0));
    }

    // ask and bid

    function testFuzz_GetAsk(uint256 amountOut, uint256 amountIn, uint256 sellAmt) public view {
        amountOut = bound(amountOut, 1, MAX_TOKEN_AMOUNT);
        amountIn = bound(amountIn, 1, MAX_TOKEN_AMOUNT);
        sellAmt = bound(sellAmt, 1, amountOut);

        Intent memory intent = _intent(amountOut, amountIn);
        uint256 ask = reactor.getAsk(intent, sellAmt);

        assertLe(ask, amountIn, "ask exceeds total");
        assertGt(ask, 0, "ask is zero");
    }

    function testFuzz_GetBid(uint256 amountOut, uint256 amountIn, uint256 buyAmt) public view {
        amountOut = bound(amountOut, 1, MAX_TOKEN_AMOUNT);
        amountIn = bound(amountIn, 1, MAX_TOKEN_AMOUNT);
        buyAmt = bound(buyAmt, 1, amountIn);

        Intent memory intent = _intent(amountOut, amountIn);
        uint256 bid = reactor.getBid(intent, buyAmt);

        assertLe(bid, amountOut, "bid exceeds total");
    }

    function testFuzz_GetAsk_FullAmountReturnsFullPrice(uint256 amountOut, uint256 amountIn) public view {
        amountOut = bound(amountOut, 1, MAX_TOKEN_AMOUNT);
        amountIn = bound(amountIn, 1, MAX_TOKEN_AMOUNT);

        Intent memory intent = _intent(amountOut, amountIn);
        assertEq(reactor.getAsk(intent, amountOut), amountIn, "full sell must return full price");
    }

    function testFuzz_GetBid_FullAmountReturnsFullTokens(uint256 amountOut, uint256 amountIn) public view {
        amountOut = bound(amountOut, 1, MAX_TOKEN_AMOUNT);
        amountIn = bound(amountIn, 1, MAX_TOKEN_AMOUNT);

        Intent memory intent = _intent(amountOut, amountIn);
        assertEq(reactor.getBid(intent, amountIn), amountOut, "full buy must return full tokens");
    }

    // verify price match

    function testFuzz_VerifyPriceMatch_BidGteAsk(uint256 tokens, uint256 price) public view {
        tokens = bound(tokens, 1, MAX_TOKEN_AMOUNT);
        price = bound(price, 1, MAX_TOKEN_AMOUNT);
        Intent memory seller_ = _intent(tokens, price);
        uint256 ask = reactor.getAsk(seller_, 1);
        Intent memory buyer_ = _intent(ask * tokens, tokens);

        reactor.verifyPriceMatch(buyer_, seller_);
    }

    function test_VerifyPriceMatch_RevertsWhenTooLow() public {
        Intent memory seller_ = _intent(10, 10);
        Intent memory buyer_ = _intent(9, 10);

        vm.expectRevert(TradeReactor.OfferTooLow.selector);
        reactor.verifyPriceMatch(buyer_, seller_);
    }

    // total execution price

    function testFuzz_GetTotalExecutionPrice(uint256 tokens, uint256 price, uint256 traded) public view {
        tokens = bound(tokens, 100, MAX_TOKEN_AMOUNT);
        price = bound(price, 100, MAX_TOKEN_AMOUNT);
        traded = bound(traded, 1, tokens);

        uint256 base = block.timestamp;
        Intent memory seller_ = Intent(address(0), address(0), address(0), tokens, address(0), price, base, base + 365 days, new bytes(0));
        uint256 ask = reactor.getAsk(seller_, 1);
        Intent memory buyer_ = Intent(address(0), address(0), address(0), ask * tokens, address(0), tokens, base, base + 365 days, new bytes(0));

        uint256 price_ = reactor.getTotalExecutionPrice(buyer_, seller_, traded);
        assertGt(price_, 0, "price must be positive");
    }

    // executable amount

    function testFuzz_ExecutableSellAmount(uint256 amountOut, uint256 amountIn, uint256 balance, uint256 allowanceAmt) public {
        amountOut = bound(amountOut, 10, MAX_TOKEN_AMOUNT);
        amountIn = bound(amountIn, 10, MAX_TOKEN_AMOUNT);
        balance = bound(balance, 0, amountOut * 2);
        allowanceAmt = bound(allowanceAmt, 0, amountOut * 2);

        token.mint(seller, balance);
        vm.prank(seller);
        token.approve(address(reactor), allowanceAmt);

        Intent memory intent = _sellIntent(amountOut, amountIn, 1 days);
        uint256 executable_ = market.executableAmount(intent);

        uint256 walletLimit = balance < allowanceAmt ? balance : allowanceAmt;
        uint256 expected = amountOut < walletLimit ? amountOut : walletLimit;

        assertEq(executable_, expected, "executable sell mismatch");
    }

    function testFuzz_ExecutableBuyAmount(uint256 currencyOffered, uint256 tokensWanted) public {
        currencyOffered = bound(currencyOffered, 1e3, MAX_TOKEN_AMOUNT);
        tokensWanted = bound(tokensWanted, 1, currencyOffered);

        currency.mint(buyer, currencyOffered);
        vm.prank(buyer);
        currency.approve(address(reactor), currencyOffered);

        Intent memory intent = _buyIntent(currencyOffered, tokensWanted, 1 days);
        uint256 executable_ = market.executableAmount(intent);

        uint256 bid = reactor.getBid(intent, 1);
        uint256 balanceInTokens = currencyOffered / bid;
        uint256 expected = tokensWanted < balanceInTokens ? tokensWanted : balanceInTokens;

        assertEq(executable_, expected, "executable buy mismatch");
    }

    // executable trade

    function testFuzz_ExecutableTrade(uint256 tokens, uint256 price) public {
        tokens = bound(tokens, 10, MAX_TOKEN_AMOUNT);
        price = bound(price, 10, MAX_TOKEN_AMOUNT);

        Intent memory sellerIntent = _sellIntent(tokens, price, 1 days);
        uint256 ask = reactor.getAsk(sellerIntent, 1);
        uint256 premium = ask * tokens;

        token.mint(seller, tokens);
        vm.prank(seller);
        token.approve(address(reactor), tokens);

        currency.mint(buyer, premium);
        vm.prank(buyer);
        currency.approve(address(reactor), premium);

        Intent memory buyerIntent = _buyIntent(premium, tokens, 1 days);

        uint256 executable_ = market.executableTrade(sellerIntent, buyerIntent);
        assertEq(executable_, tokens, "must match full tradeable amount");
    }

    // validate order

    function testFuzz_ValidateOrder_BalanceAndAllowance(uint256 amountOut, uint256 balance, uint256 allowanceAmt) public {
        amountOut = bound(amountOut, 10, MAX_TOKEN_AMOUNT);
        balance = bound(balance, 0, amountOut * 2);
        allowanceAmt = bound(allowanceAmt, 0, amountOut * 2);

        token.mint(seller, balance);
        vm.prank(seller);
        token.approve(address(reactor), allowanceAmt);

        Intent memory intent = _sellIntent(amountOut, 100, 1 days);
        bytes memory sig = _signIntent(sellerKey, intent);

        (uint256 unfilled, uint256 bal, uint256 allow_) = market.validateOrder(intent, sig);
        assertEq(unfilled, amountOut, "unfilled must match amountOut");
        assertEq(bal, balance, "balance must match");
        assertEq(allow_, allowanceAmt, "allowance must match");
    }

    function testFuzz_ValidateOrder_CancelledReverts(uint256 amountOut) public {
        amountOut = bound(amountOut, 10, MAX_TOKEN_AMOUNT);

        Intent memory intent = _sellIntent(amountOut, 100, 1 days);
        bytes memory sig = _signIntent(sellerKey, intent);

        vm.prank(seller);
        reactor.cancelIntent(intent);

        vm.expectRevert(SecondaryMarket.UserCancelled.selector);
        market.validateOrder(intent, sig);
    }

    // process

    function testFuzz_Process_TradeExecution(uint256 tokens, uint256 price) public {
        tokens = bound(tokens, 10, MAX_TOKEN_AMOUNT);
        price = bound(price, 10, MAX_TOKEN_AMOUNT);

        Intent memory sellerIntent = _sellIntent(tokens, price, 1 days);
        uint256 ask = reactor.getAsk(sellerIntent, 1);
        uint256 premium = ask * tokens;

        token.mint(seller, tokens);
        vm.prank(seller);
        token.approve(address(reactor), tokens);

        currency.mint(buyer, premium);
        vm.prank(buyer);
        currency.approve(address(reactor), premium);

        Intent memory buyerIntent = _buyIntent(premium, tokens, 1 days);

        bytes memory sellerSig = _signIntent(sellerKey, sellerIntent);
        bytes memory buyerSig = _signIntent(buyerKey, buyerIntent);

        market.process(sellerIntent, sellerSig, buyerIntent, buyerSig, tokens);

        assertEq(token.balanceOf(seller), 0, "seller token balance zeroed");
        assertEq(token.balanceOf(buyer), tokens, "buyer received tokens");
    }
}
