/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.8.0 <0.9.0;

import "./Nonce.sol";
import "./RLPEncode.sol";

contract MultiSigWallet is Nonce {

  // Version history
  // Version 4: added event for send value
  // Version 5: added version field and changed chain id
  // Version 6: fixed potential reentrancy in execute
  // Version 7: support authorizations, moved initialization to subclass, enable itself as signer
  // Version 8: multichain synchronization with CCIP
  // Version 9: removes setSigner isContract check
  // Version 10: MultichainWallet bug fix
  // Version 11: local IERC20/SafeERC20, plain LINK approve, own RLP encoding, no Address library
  uint8 public constant VERSION = 11;

  mapping (address signer => uint8 power) internal power; // The addresses that can co-sign transactions and the number of signatures needed

  uint16 public signerCount;

  event SignerChange(
    address indexed signer,
    uint8 signaturesNeeded
  );

  event Transacted(
    address indexed toAddress,  // The address the transaction was sent to
    bytes4 selector, // selected operation
    address[] signers // Addresses of the signers used to initiate the transaction
  );

  event Received(address indexed sender, uint amount);
  event SentEth(address indexed target, uint amount);

	/*//////////////////////////////////////////////////////////////
                            Custom errors
	//////////////////////////////////////////////////////////////*/
  /// Call needs to provide signature data. 
  error Multisig_SignatureMissing();
  /// Sinature data isn't valid for the transaction or insufficient signer have signed the transaction. 
  /// @param signer The ecrecover'd signer.
  error Multisig_InvalidSignDataOrInsufficientCosigner(address signer);
  /// Each signature data entry has to be from a unique address. 
  /// @param from The address which has produced more than one signature. 
  error Multisig_DuplicateSignature(address from);
  /// Signer is a contract or the 0x0 address. 
  /// @param signer The address of the invalid signer. 
  error Multisig_InvalidSigner(address signer);
  /// The multisig needs to have > 0 signers. 
  error Multisig_InsufficientSigners();
  /// Sender has to be single signer or the multisig itself. 
  /// @param sender The msg.sender of the transaction. 
  error Multisig_UnauthorizedSender(address sender);
  /// Migration can't override current signer. 
  /// param destination The address to which the signer rights should be migrated. 
  error Multisig_InvalidDestination(address destination);
  /// The call carries data but the target has no code, so it would succeed without doing anything.
  /// @param target The address the transaction was sent to.
  error Multisig_NotAContract(address target);
  /// The call reverted without any return data.
  error Multisig_CallFailed();

  // We use the gas price field to get a unique id into our transactions.
  // Note that 32 bits do not guarantee that no one can generate a contract with the
  // same id, but it practically rules out that someone accidentally creates two
  // two multisig contracts with the same id, and that's all we need to prevent
  // replay-attacks.
  function contractId() public view returns (bytes memory) {
    return RLPEncode.toBytes(contractIdValue());
  }

  function contractIdValue() private view returns (uint256) {
    return uint32(uint160(address(this))) ^ block.chainid;
  }

  /**
   * It should be possible to store ether on this address.
   */
  receive() external payable {
    emit Received(msg.sender, msg.value);
  }

  /**
   * Checks if the provided signatures suffice to sign the transaction and if the nonce is correct.
   */
  function checkSignatures(uint128 nonce, address to, uint value, bytes calldata data,
    uint8[] calldata v, bytes32[] calldata r, bytes32[] calldata s) external view returns (address[] memory) {
    bytes32 transactionHash = calculateTransactionHash(nonce, to, value, data);
    return verifySignatures(transactionHash, v, r, s);
  }

  /**
   * Checks if the execution of a transaction would succeed if it was properly signed.
   */
  function checkExecution(address to, uint value, bytes calldata data) external {
    call(to, value, data);
    revert("Test passed. Reverting.");
  }

  function execute(uint128 nonce, address to, uint value, bytes calldata data, uint8[] calldata v, bytes32[] calldata r, bytes32[] calldata s) external returns (bytes memory) {
    bytes32 transactionHash = calculateTransactionHash(nonce, to, value, data);
    address[] memory found = verifySignatures(transactionHash, v, r, s);
    flagUsed(nonce);
    bytes memory returndata = call(to, value, data);
    emit Transacted(to, extractSelector(data), found);
    if (value > 0) {emit SentEth(to, value);}
    return returndata;
  }

  /**
   * Low-level call that bubbles up the revert data of the target.
   */
  function call(address to, uint value, bytes calldata data) private returns (bytes memory returndata) {
    if (data.length != 0 && to.code.length == 0) revert Multisig_NotAContract(to);
    bool success;
    (success, returndata) = to.call{value: value}(data);
    if (!success) {
      if (returndata.length == 0) revert Multisig_CallFailed();
      assembly ("memory-safe") {
        revert(add(returndata, 0x20), mload(returndata))
      }
    }
  }

  function extractSelector(bytes calldata data) private pure returns (bytes4){
    return data.length < 4 ? bytes4(0) : bytes4(data[:4]);
  }

  /**
   * The hash the signers sign: the EIP-155 signing hash of a legacy transaction
   * [nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0], with the sequence
   * number in the nonce field and the contract id in the gas price field.
   * Note: does not work with contract creation
   */
  function calculateTransactionHash(uint128 sequence, address to, uint value, bytes calldata data)
    internal view returns (bytes32){
    bytes memory items = abi.encodePacked(
      RLPEncode.encodeUint(sequence),          // sequence number instead of nonce
      RLPEncode.encodeUint(contractIdValue()), // contract id instead of gas price
      hex"825208",                             // 21000 gas limitation, cannot be lower
      hex"94", to,
      RLPEncode.encodeUint(value),
      RLPEncode.lengthPrefix(data), data,
      RLPEncode.encodeUint(block.chainid),
      hex"8080"                                // r and s
    );
    return keccak256(abi.encodePacked(RLPEncode.lengthPrefix(items.length, 0xc0), items));
  }

  function verifySignatures(bytes32 transactionHash, uint8[] calldata v, bytes32[] calldata r, bytes32[] calldata s)
    public view returns (address[] memory) {
    address[] memory found = new address[](r.length);
    if (r.length == 0 ) {
      revert Multisig_SignatureMissing();
    }
    for (uint i = 0; i < r.length; i++) {
      address signer = ecrecover(transactionHash, v[i], r[i], s[i]);
      uint8 signaturesNeeded = signers(signer);
      if (signaturesNeeded == 0 || signaturesNeeded > r.length) {
        revert Multisig_InvalidSignDataOrInsufficientCosigner(signer);
      }
      found[i] = signer;
    }
    requireNoDuplicates(found);
    return found;
  }

  /**
   * Returns the signatory power of the signer.
   * Function name is 'signers' to keep back-wards compatilibity with anyone that
   * previously accessed the previously public array 'signers' (now 'power') using the automatically generated
   * getter function.
   */
  function signers(address signer) public view returns (uint8) {
    if (signer == address(this)){
      return 1;
    } else {
      return power[signer];
    }
  }

  function requireNoDuplicates(address[] memory found) private pure {
    for (uint i = 0; i < found.length; i++) {
      for (uint j = i+1; j < found.length; j++) {
        if (found[i] == found[j]) {
          revert Multisig_DuplicateSignature(found[i]);
        }
      }
    }
  }

  /**
   * Call this method through execute
   */
  function setSigner(address signer, uint8 signaturesNeeded) external authorized {
    _setSigner(signer, signaturesNeeded);
    if (signerCount == 0) {
      revert Multisig_InsufficientSigners();
    }
  }

  function _setSigner(address signer, uint8 signaturesNeeded) internal {
    if (signer == address(0x0) || signer == address(this)) {
      revert Multisig_InvalidSigner(signer);
    }
    uint8 prevValue = power[signer];
    power[signer] = signaturesNeeded;
    if (prevValue > 0 && signaturesNeeded == 0){
      signerCount--;
    } else if (prevValue == 0 && signaturesNeeded > 0){
      signerCount++;
    }
    emit SignerChange(signer, signaturesNeeded);
  }

  modifier authorized() {
    if (signers(msg.sender) != 1) revert Multisig_UnauthorizedSender(msg.sender);
    _;
  }

}