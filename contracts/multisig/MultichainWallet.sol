// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import "./MultiSigWallet.sol";

contract MultichainWallet is CCIPReceiver, MultiSigWallet {

    uint64 public constant MAINNET_CHAIN_SELECTOR = 5009297550715157269;

    error InvalidSourceChain(uint64 selector);
    error InvalidDestinationChain();
    error InvalidSender(address sender);
    error InsufficientNativeFeeToken(uint256 found, uint256 required);

    event SyncSent(bytes32 msgId, uint64 chain, address signerList, uint8 power);
    event SyncReceived(bytes32 msgId, address signerList, uint8 power);

    constructor(IArgumentSource args) CCIPReceiver(args.router()){
        // Must only be used to initialize immutables as clones won't inherit other state
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        if (block.chainid == 1) revert InvalidDestinationChain();
        if (message.sourceChainSelector != MAINNET_CHAIN_SELECTOR) revert InvalidSourceChain(message.sourceChainSelector);
        address decodedSender = abi.decode(message.sender, (address));
        if (decodedSender != address(this)) revert InvalidSender(decodedSender);
        
        (address[] memory signerList, uint8[] memory powers) = abi.decode(message.data, (address[], uint8[]));
        for (uint i=0; i<signerList.length; i++){
            _setSigner(signerList[i], powers[i]);
            emit SyncReceived(message.messageId, signerList[i], powers[i]);
        }
    }

    function sync(uint64[] calldata targets, address[] calldata signerList, address feeToken_) external payable {
        for (uint i=0; i<targets.length; i++){
            sync(targets[i], signerList, feeToken_);
        }
    }

    function sync(uint64 chain, address signer) public payable {
        address[] memory signerList = new address[](1);
        signerList[0] = signer;
        sync(chain, signerList, address(0x0));
    }

    function sync(uint64 chain, address[] calldata signerList) public payable {
        sync(chain, signerList, address(0x0));
    }

    function sync(uint64 chain, address[] memory signerList, address feeToken_) public payable {
        uint8[] memory powers = new uint8[](signerList.length);
        for (uint i=0; i<signerList.length; i++){
            powers[i] = signers(signerList[i]);
        }
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(address(this)), // ABI-encoded receiver address
            data: abi.encode(signerList, powers), // ABI-encoded string
            tokenAmounts: new Client.EVMTokenAmount[](0), // Empty array indicating no tokens are being sent
            extraArgs: Client._argsToBytes(
                Client.GenericExtraArgsV2({
                    gasLimit: 100_000, // Gas limit for the callback on the destination chain, should be more than enough, typically 40'000
                    allowOutOfOrderExecution: true // Should always be possible according to CCIP support
                })
            ),
            // Set the feeToken  address, indicating LINK will be used for fees
            feeToken: feeToken_
        });
        uint256 fee =  IRouterClient(getRouter()).getFee(chain, message);
        bytes32 msgId;
        if (feeToken_ != address(0x0)) {
            IERC20(message.feeToken).transferFrom(msg.sender, address(this), fee);
            IERC20(message.feeToken).approve(getRouter(), fee);
            msgId = IRouterClient(getRouter()).ccipSend(chain, message);
        } else {
            if (msg.value < fee) revert InsufficientNativeFeeToken(msg.value, fee);
            msgId = IRouterClient(getRouter()).ccipSend{value: fee}(chain, message);
            // return overpaid fee to sender. We don't care about the success of this call.
            if(msg.value - fee > 0) payable(msg.sender).call{value: msg.value - fee}("");
        }
        for (uint i=0; i<signerList.length; i++){
            emit SyncSent(msgId, chain, signerList[i], powers[i]);
        }
    }

}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface IArgumentSource {
    function router() external returns (address);
}