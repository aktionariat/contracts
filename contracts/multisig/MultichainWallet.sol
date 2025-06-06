// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";

contract MultisigWallet is CCIPReceiver {

    uint64 public constant MAINNET_CHAIN_SELECTOR = 5009297550715157269;
    address public immutable LINK_TOKEN;

    error InvalidSourceChain(uint64 selector);
    error InvalidSender(address sender);
    error InsufficientNativeFeeToken(uint256 found, uint256 required);

    event SyncSent(bytes32 msgId, uint64 chain, address signer, uint8 power);
    event SyncReceived(address signer, uint8 power);

    constructor(address router, address linkToken) CCIPReceiver(router){
        IERC20(linkToken).approve(router, type(uint256).max);
        LINK_TOKEN = linkToken;
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        if (message.sourceChainSelector != MAINNET_CHAIN_SELECTOR) revert InvalidSourceChain(message.sourceChainSelector);
        address decodedSender = abi.decode(message.sender, (address));
        if (decodedSender != address(this)) revert InvalidSender(decodedSender);
        
        (address signer, uint8 power) = abi.decode(message.data, (address, uint8));
        _setSigner(signer, power);
    }

    function _setSigner(address signer, uint8 power) internal {
        emit SyncReceived(signer, power);
    }

    function signers(address signer) public view returns (uint8) {
        return uint8(uint160(signer));
    }

    function sync(uint64 chain, address signer, bool useLink) external payable {
        uint8 power = signers(signer);
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(address(this)), // ABI-encoded receiver address
            data: abi.encode(signer, power), // ABI-encoded string
            tokenAmounts: new Client.EVMTokenAmount[](0), // Empty array indicating no tokens are being sent
            extraArgs: Client._argsToBytes(
                // Additional arguments, setting gas limit and allowing out-of-order execution.
                // Best Practice: For simplicity, the values are hardcoded. It is advisable to use a more dynamic approach
                // where you set the extra arguments off-chain. This allows adaptation depending on the lanes, messages,
                // and ensures compatibility with future CCIP upgrades. Read more about it here: https://docs.chain.link/ccip/concepts/best-practices/evm#using-extraargs
                Client.GenericExtraArgsV2({
                    gasLimit: 200_000, // Gas limit for the callback on the destination chain
                    allowOutOfOrderExecution: true // Allows the message to be executed out of order relative to other messages from the same sender
                })
            ),
            // Set the feeToken  address, indicating LINK will be used for fees
            feeToken: useLink ? LINK_TOKEN : address(0)
        });
        uint256 fee =  IRouterClient(getRouter()).getFee(chain, message);
        bytes32 msgId;
        if (useLink) {
            IERC20(message.feeToken).transferFrom(msg.sender, address(this), fee);
            IERC20(message.feeToken).approve(getRouter(), fee);
            msgId = IRouterClient(getRouter()).ccipSend(chain, message);
        } else {
            if (msg.value < fee) revert InsufficientNativeFeeToken(msg.value, fee);
            msgId = IRouterClient(getRouter()).ccipSend{value: fee}(chain, message);
            // return overpaid fee to sender. We don't care about the success of this call.
            if(msg.value - fee > 0) payable(msg.sender).call{value: msg.value - fee}("");
        }
        emit SyncSent(msgId, chain, signer, power);
    }

}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}