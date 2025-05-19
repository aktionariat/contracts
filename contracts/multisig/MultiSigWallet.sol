/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity 0.8.29;

import "../utils/Address.sol";
import "./RLPEncode.sol";
import "./Nonce.sol";

contract MultiSigWallet is Nonce {

  // Version history
  // Version 4: added event for send value
  // Version 5: added version field and changed chain id
  // Version 6: fixed potential reentrancy in execute
  // Version 7: support authorizations, moved initialization to subclass, enable itself as signer
  uint8 public constant VERSION = 0x7;

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

  // We use the gas price field to get a unique id into our transactions.
  // Note that 32 bits do not guarantee that no one can generate a contract with the
  // same id, but it practically rules out that someone accidentally creates two
  // two multisig contracts with the same id, and that's all we need to prevent
  // replay-attacks.
  function contractId() public view returns (bytes memory) {
    return toBytes(uint32(uint160(address(this))));
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
    bytes32 transactionHash = calculateTransactionHash(nonce, contractId(), to, value, data);
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
    bytes32 transactionHash = calculateTransactionHash(nonce, contractId(), to, value, data);
    address[] memory found = verifySignatures(transactionHash, v, r, s);
    flagUsed(nonce);
    bytes memory returndata = Address.functionCallWithValue(to, data, value);
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
    internal view returns (bytes32){
    bytes[] memory all = new bytes[](9);
    all[0] = toBytes(sequence); // sequence number instead of nonce
    all[1] = id; // contract id instead of gas price
    all[2] = bytes("\x82\x52\x08"); // 21000 gas limitation
    all[3] = abi.encodePacked (bytes1 (0x94), to);
    all[4] = toBytes(value);
    all[5] = data;
    all[6] = toBytes(block.chainid);
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

  function migrate(address destination) external {
    _migrate(msg.sender, destination);
  }

  function migrate(address source, address destination) external authorized {
    _migrate(source, destination);
  }

  function _migrate(address source, address destination) internal {
    // do not overwrite existing signer!
    if (power[destination] > 0 ) {
      revert Multisig_InvalidDestination(destination);
    }
    _setSigner(destination, power[source]);
    _setSigner(source, 0);
  }

  function _setSigner(address signer, uint8 signaturesNeeded) internal {
    if (Address.isContract(signer) || signer == address(0x0) || signer == address(this)) {
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