// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { WebAuthValidator } from "../validators/WebAuthValidator.sol";

contract WebAuthValidatorTest is WebAuthValidator {
  /// @notice Verifies a message using the P256 curve.
  /// @dev Useful for testing the P256 precompile
  /// @param message The sha256 hash of the authenticator hash and hashed client data
  /// @param rs The signature to validate (r, s) from the signed message
  /// @param pubKey The public key to validate the signature against (x, y)
  /// @return valid true if the signature is valid
  function p256Verify(
    bytes32 message,
    bytes32[2] calldata rs,
    bytes32[2] calldata pubKey
  ) external view returns (bool valid) {
    valid = rawVerify(message, rs, pubKey);
  }
}
