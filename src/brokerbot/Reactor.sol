pragma solidity ^0.8.0;

import {SignatureTransfer} from "../lib/SignatureTransfer.sol";

contract Reactor {

    struct Intent  {
        address owner;
        address tokenOut; // ERC20 token address
        uint160 amountOut; // the maximum amount allowed to spend
        address tokenIn;
        uint256 amountIn;
        uint48 expiration; // timestamp at which a spender's token allowances become invalid
        uint48 nonce; // a unique value indexed per owner,token,and spender for each signature
    }

    error OfferTooLow();

    SignatureTransfer immutable public transfer;

    constructor(SignatureTransfer _transfer){
        transfer = _transfer;
    }


    event SellIntentSignal(address token, uint160 amount, uint48 exp, uint48 nonce, address currency, uint256 proceeds, bytes signature);

    function signalIntent(SellIntent intent, bytes signature) view public {
        emit SellIntentSignal(intent.token, intent.amount, intent.expiration, intent.nonce, intent.currency, intent.proceeds, signature);
    }

    function process(SellIntent sale, bytes sigSale, Match purchase, bytes sigPurchase) public {
        // signatures will be verified in SignatureTransfer

        uint256 price = purchase.amount * sale.proceeds / sale.amount; // TODO: overflow risk?
        if (sale.token != purchase.token) revert TokenMismatch();
        if (sale.currency != purchase.currency) revert CurrencyMismatch();
        if (purchase.proceeds < price) revert OfferTooLow();
        transfer.permitWitnessTransferFrom(permit, transferDetails, owner, witness, witnessTypeString, signature);
    }

    function toPermit(ResolvedOrder memory order) internal pure returns (ISignatureTransfer.PermitTransferFrom memory) {
        return ISignatureTransfer.PermitTransferFrom({
            permitted: ISignatureTransfer.TokenPermissions({
                token: address(order.input.token),
                amount: order.input.maxAmount
            }),
            nonce: order.info.nonce,
            deadline: order.info.deadline
        });
    }

}