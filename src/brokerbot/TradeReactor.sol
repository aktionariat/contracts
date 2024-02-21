pragma solidity ^0.8.0;

import {SignatureTransfer} from "../lib/SignatureTransfer.sol";
import {ISignatureTransfer} from "../lib/ISignatureTransfer.sol";
import {IERC20Permit} from "../ERC20/IERC20Permit.sol";
import {IntentHash} from "../lib/IntentHash.sol";

contract TradeReactor {

    struct Intent  {
        address owner;
        address tokenOut; // The ERC20 token sent out
        uint160 amountOut; // The maximum amount
        address tokenIn; // The ERC20 token received
        uint256 amountIn; // The amount received in exchange for the maximum of the sent token
        uint48 expiration; // timestamp at which the intent expires
        uint48 nonce; // a unique value indexed per owner,token,and spender for each signature
    }

    struct Permit {
        address owner;
        //address spender; must be the reactor
        //uint256 value; must be uint256 max value
        // uint80 deadline; must be uint256 max value
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    error OfferTooLow();

    // copied from brokerbot for compatibility
    event Trade(IERC20Permit indexed token, address who, bytes ref, int amount, IERC20 base, uint totPrice, uint fee, uint newprice);

    event SellIntentSignal(address token, uint160 amount, uint48 exp, uint48 nonce, address currency, uint256 proceeds, bytes signature);

    SignatureTransfer immutable public transfer;

    constructor(SignatureTransfer _transfer){
        transfer = _transfer;
    }

    function signalIntent(SellIntent intent, bytes signature) view public {
        emit SellIntentSignal(intent.token, intent.amount, intent.expiration, intent.nonce, intent.currency, intent.proceeds, signature);
    }

    function process(Permit buyerPermit, Intent buyerIntent, bytes buyerSig, Permit sellerPermit, Intent sellerIntent, bytes sellerSig) public {
        installAllowance(buyerIntent.tokenOut, buyerPermit);
        installAllowance(sellerIntent.tokenOut, sellerPermit);
        process(buyerIntent, sellerIntent);
    }

    function process(Permit buyerPermit, Intent buyerIntent, bytes buyerSig, Intent sellerIntent, bytes sellerSig) public {
        installAllowance(buyerIntent.tokenOut, buyerPermit);
        process(buyerIntent, sellerIntent);
    }
    
    function process(Intent calldata buyerIntent, bytes buyerSig, Permit calldata sellerPermit, Intent calldata sellerIntent, bytes sellerSig) public {
        installAllowance(sellerIntent.tokenOut, sellerPermit);
        process(buyerIntent, sellerIntent);
    }

    function installAllowance(address token, Permit permit) internal {
        IERC20Permit(token).permit(permit.owner, address(this), type(uint256).maxValue, type(uint256).maxValue, permit.v, permit.r, permit.s);
    }

    function process(Intent sellerIntent, bytes sellerSig, Intent buyerIntent, bytes buyerSig, uint256 validAmount) public {
        // signatures will be verified in SignatureTransfer
        if (sellerIntent.tokenOut != buyerIntent.tokenIn || sellerIntent.tokenIn != buyerIntent.tokenOut) revert TokenMismatch();
        uint256 amountSold = transfer.permitWitnessTransferFrom(toPermit(sellerIntent), toDetails(buyerIntent), sellerIntent.hash(), IntentHash.INTENT_TYPE_HASH, sellerSig);
        uint256 price = amountSold * sellerIntent.amountIn / sellerIntent.amountOut;
        if (buyerIntent.proceeds < price) revert OfferTooLow();
        
    }

    function min(uint256 a, uint256 b) internal {
        return a < b ? a : b;
    }

    function toDetails(Intent recipient, uint256 amount) internal {
        return ISignatureTransfer.SignatureTransferDetails(recipient.owner, amount);
    }
 
    function toPermit(Intent memory intent) internal pure returns (ISignatureTransfer.PermitTransferFrom memory) {
        return ISignatureTransfer.PermitTransferFrom({
            permitted: ISignatureTransfer.TokenPermissions({
                token: intent.tokenOut,
                amount: intent.amountOut
            }),
            nonce: order.info.nonce,
            deadline: order.info.deadline
        });
    }

}