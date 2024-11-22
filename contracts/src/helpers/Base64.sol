// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/Base64.sol)

pragma solidity 0.8.24;

/**
 * @dev Provides a set of functions to operate with Base64 strings.
 */
library Base64 {
  /**
   * @dev Base64 Encoding/Decoding Table
   * See sections 4 and 5 of https://datatracker.ietf.org/doc/html/rfc4648
   */
  string internal constant _TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  string internal constant _TABLE_URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  /**
   * @dev Converts a `bytes` to its Bytes64 `string` representation.
   */
  function encode(bytes memory data) internal pure returns (string memory) {
    return _encode(data, _TABLE, true);
  }

  /**
   * @dev Converts a `bytes` to its Bytes64Url `string` representation.
   */
  function encodeURL(bytes memory data) internal pure returns (string memory) {
    return _encode(data, _TABLE_URL, false);
  }

  /**
   * @dev Internal table-agnostic conversion
   */
  function _encode(bytes memory data, string memory table, bool withPadding) private pure returns (string memory) {
    /**
     * Inspired by Brecht Devos (Brechtpd) implementation - MIT license
     * https://github.com/Brechtpd/base64/blob/e78d9fd951e7b0977ddca77d92dc85183770daf4/base64.sol
     */
    if (data.length == 0) return "";

    // If padding is enabled, the final length should be `bytes` data length divided by 3 rounded up and then
    // multiplied by 4 so that it leaves room for padding the last chunk
    // - `data.length + 2`  -> Round up
    // - `/ 3`              -> Number of 3-bytes chunks
    // - `4 *`              -> 4 characters for each chunk
    // If padding is disabled, the final length should be `bytes` data length multiplied by 4/3 rounded up as
    // opposed to when padding is required to fill the last chunk.
    // - `4 *`              -> 4 characters for each chunk
    // - `data.length + 2`  -> Round up
    // - `/ 3`              -> Number of 3-bytes chunks
    uint256 resultLength = withPadding ? 4 * ((data.length + 2) / 3) : (4 * data.length + 2) / 3;

    string memory result = new string(resultLength);

    /// @solidity memory-safe-assembly
    assembly {
      // Prepare the lookup table (skip the first "length" byte)
      let tablePtr := add(table, 1)

      // Prepare result pointer, jump over length
      let resultPtr := add(result, 0x20)
      let dataPtr := data
      let endPtr := add(data, mload(data))

      // In some cases, the last iteration will read bytes after the end of the data. We cache the value, and
      // set it to zero to make sure no dirty bytes are read in that section.
      let afterPtr := add(endPtr, 0x20)
      let afterCache := mload(afterPtr)
      mstore(afterPtr, 0x00)

      // Run over the input, 3 bytes at a time
      for {} lt(dataPtr, endPtr) {} {
        // Advance 3 bytes
        dataPtr := add(dataPtr, 3)
        let input := mload(dataPtr)

        // To write each character, shift the 3 byte (24 bits) chunk
        // 4 times in blocks of 6 bits for each character (18, 12, 6, 0)
        // and apply logical AND with 0x3F to bitmask the least significant 6 bits.
        // Use this as an index into the lookup table, mload an entire word
        // so the desired character is in the least significant byte, and
        // mstore8 this least significant byte into the result and continue.

        mstore8(resultPtr, mload(add(tablePtr, and(shr(18, input), 0x3F))))
        resultPtr := add(resultPtr, 1) // Advance

        mstore8(resultPtr, mload(add(tablePtr, and(shr(12, input), 0x3F))))
        resultPtr := add(resultPtr, 1) // Advance

        mstore8(resultPtr, mload(add(tablePtr, and(shr(6, input), 0x3F))))
        resultPtr := add(resultPtr, 1) // Advance

        mstore8(resultPtr, mload(add(tablePtr, and(input, 0x3F))))
        resultPtr := add(resultPtr, 1) // Advance
      }

      // Reset the value that was cached
      mstore(afterPtr, afterCache)

      if withPadding {
        // When data `bytes` is not exactly 3 bytes long
        // it is padded with `=` characters at the end
        switch mod(mload(data), 3)
        case 1 {
          mstore8(sub(resultPtr, 1), 0x3d)
          mstore8(sub(resultPtr, 2), 0x3d)
        }
        case 2 {
          mstore8(sub(resultPtr, 1), 0x3d)
        }
      }
    }

    return result;
  }

  /// @dev Decodes base64 encoded `data`.
  /// @notice Library to encode strings in Base64.
  /// author Solady (https://github.com/vectorized/solady/blob/main/src/utils/Base64.sol)
  /// author Modified from Solmate (https://github.com/transmissions11/solmate/blob/main/src/utils/Base64.sol)
  /// author Modified from (https://github.com/Brechtpd/base64/blob/main/base64.sol) by Brecht Devos - <brecht%40loopring.org>.
  ///
  /// Supports:
  /// - RFC 4648 (both standard and file-safe mode).
  /// - RFC 3501 (63: ',').
  ///
  /// Does not support:
  /// - Line breaks.
  ///
  /// Note: For performance reasons,
  /// this function will NOT revert on invalid `data` inputs.
  /// Outputs for invalid inputs will simply be undefined behaviour.
  /// It is the user's responsibility to ensure that the `data`
  /// is a valid base64 encoded string.
  function decode(string memory data) internal pure returns (bytes memory result) {
    /// @solidity memory-safe-assembly
    assembly {
      let dataLength := mload(data)

      if dataLength {
        let decodedLength := mul(shr(2, dataLength), 3)

        for {} 1 {} {
          // If padded.
          if iszero(and(dataLength, 3)) {
            let t := xor(mload(add(data, dataLength)), 0x3d3d)
            // forgefmt: disable-next-item
            decodedLength := sub(decodedLength, add(iszero(byte(30, t)), iszero(byte(31, t))))
            break
          }
          // If non-padded.
          decodedLength := add(decodedLength, sub(and(dataLength, 3), 1))
          break
        }
        result := mload(0x40)

        // Write the length of the bytes.
        mstore(result, decodedLength)

        // Skip the first slot, which stores the length.
        let ptr := add(result, 0x20)
        let end := add(ptr, decodedLength)

        // Load the table into the scratch space.
        // Constants are optimized for smaller bytecode with zero gas overhead.
        // `m` also doubles as the mask of the upper 6 bits.
        let m := 0xfc000000fc00686c7074787c8084888c9094989ca0a4a8acb0b4b8bcc0c4c8cc
        mstore(0x5b, m)
        mstore(0x3b, 0x04080c1014181c2024282c3034383c4044484c5054585c6064)
        mstore(0x1a, 0xf8fcf800fcd0d4d8dce0e4e8ecf0f4)

        for {} 1 {} {
          // Read 4 bytes.
          data := add(data, 4)
          let input := mload(data)

          // Write 3 bytes.
          // forgefmt: disable-next-item
          mstore(
            ptr,
            or(
              and(m, mload(byte(28, input))),
              shr(
                6,
                or(
                  and(m, mload(byte(29, input))),
                  shr(6, or(and(m, mload(byte(30, input))), shr(6, mload(byte(31, input)))))
                )
              )
            )
          )
          ptr := add(ptr, 3)
          if iszero(lt(ptr, end)) {
            break
          }
        }
        mstore(0x40, add(end, 0x20)) // Allocate the memory.
        mstore(end, 0) // Zeroize the slot after the bytes.
        mstore(0x60, 0) // Restore the zero slot.
      }
    }
  }
}
