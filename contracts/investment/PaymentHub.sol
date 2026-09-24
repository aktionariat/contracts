/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* MIT License with Automated License Fee Payments
*
* Copyright (c) 2022 Aktionariat AG (aktionariat.com)
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

import "../ERC20/IERC20.sol";
import "../utils/SafeERC20.sol";
import "../utils/Ownable.sol";
import "./IDirectInvestment.sol";
import "./IUniswap.sol";

/**
 * A hub for payments, to be used with the DirectInvestment contract.
 * Enables a single allowance given to this contract to be used across multiple DirectInvestment contracts.
 * Separates payment process with possible swaps from the DirectInvestment settlement logic.
 * Handles paying with the base currency of the DirectInvestment contract, or any other ERC20 token or ETH, by giving a Uniswap v3 swap path.
 * Swaps run through the Uniswap Universal Router; the hub hands it the payment and it settles into the DirectInvestment contract and returns the change.
 */

contract PaymentHub is Ownable {

    using SafeERC20 for IERC20;

    // Version History
    // Version 4: Added path to pay with any ERC20 via uniswap
    // Version 5: Added sell via permit
    // Version 6: Added transferEther function
    // Version 7: Added sell against ETH and ERC20, version, add permitinfo/swapinfo struct
    // Version 8: Use SafeERC20 for transfers
    // Version 9: Change payFromEther to include a swap path
    // Version 10: Added checkAmount to prevent underpayment of shares, removed keep ether
    // Version 11: Cleanup unused permit, remove selling, replace forwarder with owner
    // Version 12: Cleanup and rewrite for DirectInvestment v10. Remove handling ETH refunds.
    // Version 13: forceApprove for tokens like USDT, multiPay checks array lengths
    // Version 14: Uniswap Universal Router and QuoterV2, caller-supplied deadline, ETH change returned as ETH

    uint256 public constant VERSION = 14;

    // Universal Router commands and its "the router itself" recipient sentinel.
    bytes1 private constant V3_SWAP_EXACT_OUT = 0x01;
    bytes1 private constant SWEEP = 0x04;
    bytes1 private constant WRAP_ETH = 0x0b;
    bytes1 private constant UNWRAP_WETH = 0x0c;
    address private constant ROUTER_ITSELF = address(2);

    IQuoterV2 private immutable quoter;
    IUniversalRouter private immutable router;
    IERC20 private immutable weth;

    error PaymentHub_InvalidAmount();
    error PaymentHub_ArrayLengthMismatch();
    error PaymentHub_InvalidPath(IDirectInvestment directInvestment, IERC20 paymentCurrency, bytes path);

    constructor(address _owner, IQuoterV2 _quoter, IUniversalRouter _router) Ownable(_owner) {
        quoter = _quoter;
        router = _router;
        weth = IERC20(_quoter.WETH9());
    }

    /// @notice Quote the buy price in base currency for `amountShares`.
    function getPriceInBaseCurrency(IDirectInvestment directInvestment, uint256 amountShares) public view returns (uint256) {
        return directInvestment.getBuyPrice(amountShares);
    }

    /// @notice Quote the buy price for `amountShares` denominated in `paymentCurrency`.
    /// @dev Not view: routes through the Uniswap quoter. Call it off-chain.
    function getPriceInPaymentCurrency(IDirectInvestment directInvestment, uint256 amountShares, IERC20 paymentCurrency, bytes calldata path) public returns (uint256) {
        checkPath(directInvestment, paymentCurrency, path);

        uint256 priceInBase = getPriceInBaseCurrency(directInvestment, amountShares);
        (uint256 amountIn,,,) = quoter.quoteExactOutput(path, priceInBase);
        return amountIn;
    }

    /// @notice Buy `amountShares` by paying directly in the base currency.
    /// @dev Caller must have approved this contract for the base currency.
    function payFromBaseCurrencyAndNotify(IDirectInvestment directInvestment, uint256 amountShares, bytes calldata ref) public {
        require(amountShares > 0, PaymentHub_InvalidAmount());

        uint256 priceInBaseCurrency = directInvestment.getBuyPrice(amountShares);

        directInvestment.base().safeTransferFrom(msg.sender, address(directInvestment), priceInBaseCurrency);
        directInvestment.processIncoming(msg.sender, amountShares, priceInBaseCurrency, ref);
    }

    /// @notice Buy `amountShares` by paying in any ERC20, swapped to base via Uniswap. Reverts after `deadline`.
    /// @dev Caller must have approved this contract for `amountInMaximum` of `paymentCurrency`. Unused remainder is returned.
    function payFromOtherCurrencyAndNotify(IDirectInvestment directInvestment, uint256 amountShares, IERC20 paymentCurrency, uint256 amountInMaximum, bytes calldata path, uint256 deadline, bytes calldata ref) public {
        require(amountShares > 0, PaymentHub_InvalidAmount());

        checkPath(directInvestment, paymentCurrency, path);

        uint256 priceInBaseCurrency = directInvestment.getBuyPrice(amountShares);

        paymentCurrency.safeTransferFrom(msg.sender, address(router), amountInMaximum);
        bytes[] memory inputs = new bytes[](2);
        inputs[0] = swapInput(directInvestment, priceInBaseCurrency, amountInMaximum, path);
        inputs[1] = sweepInput(paymentCurrency, msg.sender);
        router.execute(abi.encodePacked(V3_SWAP_EXACT_OUT, SWEEP), inputs, deadline);

        directInvestment.processIncoming(msg.sender, amountShares, priceInBaseCurrency, ref);
    }

    /// @notice Buy `amountShares` by paying in ETH, wrapped to WETH and swapped to base via Uniswap. Reverts after `deadline`.
    /// @dev Unused ETH is returned as ETH; a caller that cannot receive ETH must pay in WETH instead.
    function payFromEtherAndNotify(IDirectInvestment directInvestment, uint256 amountShares, bytes calldata path, uint256 deadline, bytes calldata ref) public payable {
        require(amountShares > 0, PaymentHub_InvalidAmount());

        checkPath(directInvestment, weth, path);

        uint256 priceInBaseCurrency = directInvestment.getBuyPrice(amountShares);

        bytes[] memory inputs = new bytes[](3);
        inputs[0] = wrapInput(msg.value);
        inputs[1] = swapInput(directInvestment, priceInBaseCurrency, msg.value, path);
        inputs[2] = unwrapInput(msg.sender);
        router.execute{value: msg.value}(abi.encodePacked(WRAP_ETH, V3_SWAP_EXACT_OUT, UNWRAP_WETH), inputs, deadline);

        directInvestment.processIncoming(msg.sender, amountShares, priceInBaseCurrency, ref);
    }

    /// @dev Validates a V3 exactOutput path: starts with base currency, ends with `paymentCurrency`.
    function checkPath(IDirectInvestment directInvestment, IERC20 paymentCurrency, bytes calldata path) internal view {
        require(path.length >= 43 && (path.length - 20) % 23 == 0, PaymentHub_InvalidPath(directInvestment, paymentCurrency, path));
        require(address(bytes20(path[0:20])) == address(directInvestment.base()), PaymentHub_InvalidPath(directInvestment, paymentCurrency, path));
        require(address(bytes20(path[path.length - 20:])) == address(paymentCurrency), PaymentHub_InvalidPath(directInvestment, paymentCurrency, path));
    }

    /// @dev WRAP_ETH: the router wraps `amount` of the ETH it was sent and keeps the WETH.
    function wrapInput(uint256 amount) private pure returns (bytes memory) {
        return abi.encode(ROUTER_ITSELF, amount);
    }

    /// @dev V3_SWAP_EXACT_OUT: exactly `amountOut` into the DirectInvestment, paid from the router's own balance (payerIsUser = false), no per-hop price limits.
    function swapInput(IDirectInvestment directInvestment, uint256 amountOut, uint256 amountInMaximum, bytes calldata path) private pure returns (bytes memory) {
        return abi.encode(directInvestment, amountOut, amountInMaximum, path, false, new uint256[](0));
    }

    /// @dev SWEEP: the router's remaining `token` balance, i.e. the change, goes to `payer`.
    function sweepInput(IERC20 token, address payer) private pure returns (bytes memory) {
        return abi.encode(token, payer, 0);
    }

    /// @dev UNWRAP_WETH: the router's remaining WETH, i.e. the change, goes to `payer` as ETH.
    function unwrapInput(address payer) private pure returns (bytes memory) {
        return abi.encode(payer, 0);
    }

    /// @notice Owner rescue for tokens accidentally sent to the hub.
    function withdrawToken(IERC20 tokenAddress, address to, uint256 amount) external onlyOwner {
        tokenAddress.safeTransfer(to, amount);
    }

    /// @notice Pay multiple recipients in one tx, e.g. for dividends. Unrelated to share purchases.
    function multiPay(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) public {
        require(recipients.length == amounts.length, PaymentHub_ArrayLengthMismatch());
        for (uint i=0; i<recipients.length; i++) {
            IERC20(token).safeTransferFrom(msg.sender, recipients[i], amounts[i]);
        }
    }
}
