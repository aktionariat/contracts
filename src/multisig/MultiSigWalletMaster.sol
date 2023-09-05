/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.8.0;

import "../utils/Address.sol";
import "../utils/Initializable.sol";
import "./RLPEncode.sol";
import "./Nonce.sol";

/**
 * Documented in ../../doc/multisig.md
 * Version 4: include SentEth event
 */
contract MultiSigWalletMaster is Nonce, Initializable {

  // Version history
  // Version 4: added event for send value
  // Version 5: added version field and changed chain id
  uint8 public constant VERSION = 0x5;

  mapping (address => uint8) public signers; // The addresses that can co-sign transactions and the number of signatures needed

  uint16 public signerCount;
  bytes public contractId; // most likely unique id of this contract

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

  function initialize(address owner) external initializer {
    // We use the gas price field to get a unique id into our transactions.
    // Note that 32 bits do not guarantee that no one can generate a contract with the
    // same id, but it practically rules out that someone accidentally creates two
    // two multisig contracts with the same id, and that's all we need to prevent
    // replay-attacks.
    contractId = toBytes(uint32(uint160(address(this))));
    signerCount = 0;
    _setSigner(owner, 1); // set initial owner
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
    bytes32 transactionHash = calculateTransactionHash(nonce, contractId, to, value, data);
    return verifySignatures(transactionHash, v, r, s);
  }

  /**
   * Checks if the execution of a transaction would succeed if it was properly signed.
   */
  function checkExecution(address to, uint value, bytes calldata data) external {
    Address.functionCallWithValue(to, data, value);
    revert("Test passed. Reverting.");
  }

  function execute(uint128 nonce, address to, uint value, bytes calldata data, uint8[] calldata v, bytes32[] calldata r, bytes32[] calldata s) external returns (bytes memory) {
    bytes32 transactionHash = calculateTransactionHash(nonce, contractId, to, value, data);
    address[] memory found = verifySignatures(transactionHash, v, r, s);
    bytes memory returndata = Address.functionCallWithValue(to, data, value);
    flagUsed(nonce);
    emit Transacted(to, extractSelector(data), found);
    if (value > 0) {emit SentEth(to, value);}
    return returndata;
  }

  function extractSelector(bytes calldata data) private pure returns (bytes4){
    if (data.length < 4){
      return bytes4(0);
    } else {
      return bytes4(data[0]) | (bytes4(data[1]) >> 8) | (bytes4(data[2]) >> 16) | (bytes4(data[3]) >> 24);
    }
  }

  function toBytes (uint256 x) public pure returns (bytes memory result) {
    uint l = 0;
    uint xx = x;
    if (x >= 0x100000000000000000000000000000000) { x >>= 128; l += 16; }
    if (x >= 0x10000000000000000) { x >>= 64; l += 8; }
    if (x >= 0x100000000) { x >>= 32; l += 4; }
    if (x >= 0x10000) { x >>= 16; l += 2; }
    if (x >= 0x100) { x >>= 8; l += 1; }
    if (x > 0x0) { l += 1; }
    assembly {
      result := mload (0x40)
      mstore (0x40, add (result, add (l, 0x20)))
      mstore (add (result, l), xx)
      mstore (result, l)
    }
  }

  // Note: does not work with contract creation
  function calculateTransactionHash(uint128 sequence, bytes memory id, address to, uint value, bytes calldata data)
    internal pure returns (bytes32){
    bytes[] memory all = new bytes[](9);
    all[0] = toBytes(sequence); // sequence number instead of nonce
    all[1] = id; // contract id instead of gas price
    all[2] = bytes("\x82\x52\x08"); // 21000 gas limitation
    all[3] = abi.encodePacked (bytes1 (0x94), to);
    all[4] = toBytes(value);
    all[5] = data;
    all[6] = toBytes(3); //chain Identifier
    all[7] = new bytes(0);
    for (uint i = 0; i<8; i++){
      if (i != 2 && i!= 3) {
        all[i] = RLPEncode.encodeBytes(all[i]);
      }
    }
    all[8] = all[7];
    return keccak256(RLPEncode.encodeList(all));
  }

  function verifySignatures(bytes32 transactionHash, uint8[] calldata v, bytes32[] calldata r, bytes32[] calldata s)
    public view returns (address[] memory) {
    address[] memory found = new address[](r.length);
    if (r.length == 0 ) {
      revert Multisig_SignatureMissing();
    }
    for (uint i = 0; i < r.length; i++) {
      address signer = ecrecover(transactionHash, v[i], r[i], s[i]);
      uint8 signaturesNeeded = signers[signer];
      if (signaturesNeeded == 0 || signaturesNeeded > r.length) {
        revert Multisig_InvalidSignDataOrInsufficientCosigner(signer);
      }
      found[i] = signer;
    }
    requireNoDuplicates(found);
    return found;
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

  function migrate(address destination) external {
    _migrate(msg.sender, destination);
  }

  function migrate(address source, address destination) external authorized {
    _migrate(source, destination);
  }

  function _migrate(address source, address destination) private {
    // do not overwrite existing signer!
    if (signers[destination] > 0 ) {
      revert Multisig_InvalidDestination(destination);
    }
    _setSigner(destination, signers[source]);
    _setSigner(source, 0);
  }

  function _setSigner(address signer, uint8 signaturesNeeded) private {
    if (Address.isContract(signer) || signer == address(0x0)) {
      revert Multisig_InvalidSigner(signer);
    }
    uint8 prevValue = signers[signer];
    signers[signer] = signaturesNeeded;
    if (prevValue > 0 && signaturesNeeded == 0){
      signerCount--;
    } else if (prevValue == 0 && signaturesNeeded > 0){
      signerCount++;
    }
    emit SignerChange(signer, signaturesNeeded);
  }

  modifier authorized() {
    if (address(this) != msg.sender && signers[msg.sender] != 1) {
      revert Multisig_UnauthorizedSender(msg.sender);
    }
    _;
  }

}