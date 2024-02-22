// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * Copied from github.com/Uniswap/permit2/blob/main/src/SignatureTransfer.sol and modified.
 */
import {ISignatureTransfer} from "./ISignatureTransfer.sol";
import {IERC20} from "../ERC20/IERC20.sol";
import {SignatureVerification} from "./SignatureVerification.sol";
import {PermitHash} from "./PermitHash.sol";
import {EIP712} from "./EIP712.sol";

contract SignatureTransfer is ISignatureTransfer, EIP712 {

    using SignatureVerification for bytes;
    using PermitHash for PermitTransferFrom;

    /// @inheritdoc ISignatureTransfer
    mapping(address => mapping(uint256 => uint256)) public nonceBitmap;
    mapping(address => mapping(uint256 => uint256)) public partialFills;

    /// @notice Thrown when validating an inputted signature that is stale
    /// @param signatureDeadline The timestamp at which a signature is no longer valid
    error SignatureExpired(uint256 signatureDeadline);

    /// @notice Thrown when validating that the inputted nonce has not been used
    error InvalidNonce();

    error OverFilled();

    function permitTransferFrom(PermitTransferFrom memory permit, SignatureTransferDetails calldata transferDetails, address owner, bytes calldata signature) external {
        _permitTransferFrom(permit, transferDetails, owner, permit.hash(), signature);
    }

    /// @inheritdoc ISignatureTransfer
    function permitWitnessTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata witnessTypeString,
        bytes calldata signature
    ) external {
        _permitTransferFrom(permit, transferDetails, owner, permit.hashWithWitness(witness, witnessTypeString), signature);
    }

    function isFreeNonce(address owner, uint256 nonce) public view returns (bool){
        (uint256 wordPos, uint256 bitPos) = bitmapPositions(nonce);
        uint256 bit = 1 << bitPos;
        return nonceBitmap[owner][wordPos] & bit == 0; 
    }

    function getPermittedAmount(address owner, PermitTransferFrom calldata permit) public view returns (uint256) {
        if (isFreeNonce(owner, permit.nonce)){
            return permit.permitted.amount - partialFills[owner][permit.nonce];
        } else {
            return 0;
        }
    }

    /// @notice Transfers a token using a signed permit message.
    /// @param permit The permit data signed over by the owner
    /// @param dataHash The EIP-712 hash of permit data to include when checking signature
    /// @param owner The owner of the tokens to transfer
    /// @param transferDetails The spender's requested transfer details for the permitted token
    /// @param signature The signature to verify
    function _permitTransferFrom(PermitTransferFrom memory permit, SignatureTransferDetails calldata transferDetails, address owner, bytes32 dataHash, bytes calldata signature) private {
        uint256 requestedAmount = transferDetails.requestedAmount;

        if (block.timestamp > permit.deadline) revert SignatureExpired(permit.deadline);

        _useUnorderedNonce(owner, permit.nonce, requestedAmount, permit.permitted.amount);

        signature.verify(_hashTypedData(dataHash), owner);

        IERC20(permit.permitted.token).transferFrom(owner, transferDetails.to, requestedAmount);
    }

    /// @inheritdoc ISignatureTransfer
    function invalidateUnorderedNonces(uint256 wordPos, uint256 mask) external {
        nonceBitmap[msg.sender][wordPos] |= mask;

        emit UnorderedNonceInvalidation(msg.sender, wordPos, mask);
    }

    /// @notice Returns the index of the bitmap and the bit position within the bitmap. Used for unordered nonces
    /// @param nonce The nonce to get the associated word and bit positions
    /// @return wordPos The word position or index into the nonceBitmap
    /// @return bitPos The bit position
    /// @dev The first 248 bits of the nonce value is the index of the desired bitmap
    /// @dev The last 8 bits of the nonce value is the position of the bit in the bitmap
    function bitmapPositions(uint256 nonce) private pure returns (uint256 wordPos, uint256 bitPos) {
        wordPos = uint248(nonce >> 8);
        bitPos = uint8(nonce);
    }

    /// @notice Checks whether a nonce is taken and sets the bit at the bit position in the bitmap at the word position
    /// @param from The address to use the nonce at
    /// @param nonce The nonce to spend
    function _useUnorderedNonce(address from, uint256 nonce, uint256 amount, uint256 max) internal {
        (uint256 wordPos, uint256 bitPos) = bitmapPositions(nonce);
        uint256 bit = 1 << bitPos;
        uint256 state = nonceBitmap[from][wordPos];
        if (state & bit != 0) revert InvalidNonce();

        uint256 alreadyFilled = partialFills[from][nonce];
        if (alreadyFilled + amount > max) revert OverFilled();
        if (alreadyFilled + amount < max){
            partialFills[from][nonce] = alreadyFilled + amount;
        } else {
            if (alreadyFilled > 0) delete partialFills[from][nonce]; // get some gas back 
            nonceBitmap[from][wordPos] |= bit; // flag done
        }
    }
}