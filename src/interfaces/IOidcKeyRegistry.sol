// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOidcKeyRegistry {
  /// @notice The structure representing an OIDC key.
  /// @dev Because the circuit assumes exponent 65537 exponent is not stored here.
  /// @param issHash The issuer hash.
  /// @param kid The key ID.
  /// @param rsaModulus The RSA modulus.
  struct Key {
    bytes32 issHash;
    bytes32 kid;
    uint256[17] rsaModulus;
  }

  /// @notice Emitted when a key is added to the registry.
  /// @param issHash The issuer hash.
  /// @param kid The key ID.
  /// @param n The RSA modulus.
  event KeyAdded(bytes32 indexed issHash, bytes32 indexed kid, uint256[17] n);

  /// @notice Emitted when a key is deleted from the registry.
  /// @param issHash The issuer hash.
  /// @param kid The key ID.
  event KeyDeleted(bytes32 indexed issHash, bytes32 indexed kid);

  function hashIssuer(string memory iss) external pure returns (bytes32);
  function getKey(bytes32 issHash, bytes32 kid) external view returns (Key memory);
  function addKey(Key memory newKey) external;
  function addKeys(Key[] memory newKeys) external;
  function deleteKey(bytes32 issHash, bytes32 kid) external;
}
