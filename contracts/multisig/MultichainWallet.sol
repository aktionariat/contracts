/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.8.0 <0.9.0;

import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MultiSigWallet.sol";
import "./MultichainWalletArgumentSource.sol";

contract MultichainWallet is CCIPReceiver, MultiSigWallet {

    using SafeERC20 for IERC20;

    uint64 public constant MAINNET_CHAIN_SELECTOR = 5009297550715157269;

    address public immutable LINK; // LINK token used as CCIP fee. Address differs per chain.

    error InvalidSourceChain(uint64 selector);
    error InvalidDestinationChain();
    error InvalidSender(address sender);

    event SyncSent(bytes32 msgId, uint64 chain, address signerList, uint8 power);
    event SyncReceived(bytes32 msgId, address signerList, uint8 power);

    constructor(MultichainWalletArgumentSource args) CCIPReceiver(args.router()){
        // Must only be used to initialize immutables as clones won't inherit other state
        LINK = args.link();
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

    function sync(uint64[] calldata targets, address[] calldata signerList) external {
        uint8[] memory powers = _getPowers(signerList);
        for (uint i=0; i<targets.length; i++){
            _sync(targets[i], signerList, powers);
        }
    }

    function sync(uint64 chain, address signer) external {
        address[] memory signerList = new address[](1);
        signerList[0] = signer;
        _sync(chain, signerList, _getPowers(signerList));
    }

    function sync(uint64 chain, address[] calldata signerList) external {
        _sync(chain, signerList, _getPowers(signerList));
    }

    function _getPowers(address[] memory signerList) internal view returns (uint8[] memory powers) {
        powers = new uint8[](signerList.length);
        for (uint i=0; i<signerList.length; i++){
            powers[i] = signers(signerList[i]);
        }
    }

    function _buildSyncMessage(address[] memory signerList, uint8[] memory powers) internal view returns (Client.EVM2AnyMessage memory) {
        return Client.EVM2AnyMessage({
            receiver: abi.encode(address(this)), // ABI-encoded receiver address
            data: abi.encode(signerList, powers), // ABI-encoded string
            tokenAmounts: new Client.EVMTokenAmount[](0), // Empty array indicating no tokens are being sent
            extraArgs: Client._argsToBytes(
                Client.GenericExtraArgsV2({
                    gasLimit: 100_000, // Gas limit for the callback on the destination chain, should be more than enough, typically 40'000
                    allowOutOfOrderExecution: true // Should always be possible according to CCIP support
                })
            ),
            feeToken: LINK
        });
    }

    function _sync(uint64 chain, address[] memory signerList, uint8[] memory powers) internal {
        Client.EVM2AnyMessage memory message = _buildSyncMessage(signerList, powers);
        IRouterClient router = IRouterClient(getRouter());
        uint256 fee = router.getFee(chain, message);
        IERC20(LINK).safeTransferFrom(msg.sender, address(this), fee);
        IERC20(LINK).forceApprove(address(router), fee);
        bytes32 msgId = router.ccipSend(chain, message);
        for (uint i=0; i<signerList.length; i++){
            emit SyncSent(msgId, chain, signerList[i], powers[i]);
        }
    }

}
