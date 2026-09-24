/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.8.0 <0.9.0;

/**
 * Recursive length prefix (RLP) encoding, https://ethereum.org/developers/docs/data-structures-and-encoding/rlp,
 * reduced to what MultiSigWallet needs to rebuild the signing hash of a legacy transaction:
 * unsigned integers and the length prefixes of byte strings and lists.
 */
library RLPEncode {

  /**
   * The encoding of an unsigned integer: its minimal big-endian bytes as a byte string.
   */
  function encodeUint(uint256 x) internal pure returns (bytes memory) {
    if (x > 0 && x < 0x80) return abi.encodePacked(uint8(x)); // a single byte below 0x80 is its own encoding
    bytes memory b = toBytes(x);
    return abi.encodePacked(uint8(0x80 + b.length), b);
  }

  /**
   * The prefix of the byte string b, to be followed by b itself. Empty if b is its own encoding.
   */
  function lengthPrefix(bytes calldata b) internal pure returns (bytes memory) {
    if (b.length == 1 && uint8(b[0]) < 0x80) return new bytes(0);
    return lengthPrefix(b.length, 0x80);
  }

  /**
   * The prefix of a byte string (offset 0x80) or a list (offset 0xc0) with a payload of the given length.
   */
  function lengthPrefix(uint256 length, uint8 offset) internal pure returns (bytes memory) {
    if (length <= 55) return abi.encodePacked(uint8(offset + length));
    bytes memory l = toBytes(length);
    return abi.encodePacked(uint8(offset + 55 + l.length), l);
  }

  /**
   * Minimal big-endian encoding of x, empty for zero.
   */
  function toBytes(uint256 x) internal pure returns (bytes memory result) {
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
}
