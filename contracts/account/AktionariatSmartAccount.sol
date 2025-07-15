/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.8.0 <0.9.0;

import "../utils/Address.sol";
import "../multisig/RLPEncode.sol";
import "../multisig/Nonce.sol";

contract AktionariatSmartAccount is Nonce {

  // Version history
  uint8 public constant VERSION = 0x1;

	/*//////////////////////////////////////////////////////////////
                            Custom errors
	//////////////////////////////////////////////////////////////*/
  /// Signer is not self
  /// @param signer The address of the invalid signer. 
  error Multisig_InvalidSigner(address signer);
  
  function contractId() public view returns (bytes memory) {
    return toBytes(uint32(uint160(address(this))) ^ block.chainid);
  }

  /**
   * Checks if the execution of a transaction would succeed if it was properly signed.
   */
  function checkExecution(address to, uint value, bytes calldata data) external {
    Address.functionCallWithValue(to, data, value);
    revert("Test passed. Reverting.");
  }

  /**
   * Checks if the provided signatures suffice to sign the transaction and if the nonce is correct.
   */
  function checkSignature(uint128 nonce, address to, uint value, bytes calldata data, uint8 v, bytes32 r, bytes32 s) public view {
    bytes32 transactionHash = calculateTransactionHash(nonce, to, value, data);
    address signer = ecrecover(transactionHash, v, r, s);
    if (signer != address(this)) {
      revert Multisig_InvalidSigner(signer);
    }
  }

  function execute(uint128 nonce, address to, uint value, bytes calldata data, uint8 v, bytes32 r, bytes32 s) external returns (bytes memory) {
    checkSignature(nonce, to, value, data, v, r, s);
    flagUsed(nonce);
    bytes memory returndata = Address.functionCallWithValue(to, data, value);
    return returndata;
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
  function calculateTransactionHash(uint128 nonce, address to, uint value, bytes calldata data)
    internal view returns (bytes32){
    bytes[] memory all = new bytes[](9);
    all[0] = toBytes(nonce);                        // nonce provided by Nonce.sol
    all[1] = contractId();                          // id based on this implementations address and chain id
    all[2] = bytes("\x82\x52\x08");                 // 21000 gas limitation, cannot be lower
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
}