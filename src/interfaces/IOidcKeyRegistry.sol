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

  /// @notice Thrown when a key is not found for the given issuer hash and key ID.
  /// @param issHash The issuer hash associated with the key.
  /// @param kid The key ID that was not found.
  error KeyNotFound(bytes32 issHash, bytes32 kid);

  /// @notice Thrown when the number of keys exceeds the maximum allowed limit (MAX_KEYS).
  /// @param count The number of keys that exceeded the limit.
  error KeyCountLimitExceeded(uint256 count);

  /// @notice Thrown when the issuer hash of the keys being added does not match the expected issuer hash.
  /// @dev This is to ensure that all added keys are for the same issuer.
  /// @param expectedIssHash The expected issuer hash.
  /// @param actualIssHash The actual issuer hash provided.
  error IssuerHashMismatch(bytes32 expectedIssHash, bytes32 actualIssHash);

  /// @notice Thrown when the key ID is zero, which is not allowed.
  /// @param index The index of the key in the batch being validated.
  error KeyIdCannotBeZero(uint256 index);

  /// @notice Thrown when the modulus is zero, which is not allowed.
  /// @param kid The id of the key in the batch being validated.
  error ModulusCannotBeZero(bytes32 kid);

  /// @notice Thrown when a modulus chunk exceeds the maximum allowed size of 121 bits.
  /// @param kid The id of the key in the batch being validated.
  /// @param chunkIndex The index of the chunk that exceeded the limit.
  /// @param chunkValue The value of the chunk that exceeded the limit.
  error ModulusChunkTooLarge(bytes32 kid, uint256 chunkIndex, uint256 chunkValue);

  error EvenRsaModulus(bytes32 kid);

  /// @notice Thrown when trying to register a key with a kid already known
  /// @param kid key id that caused the conflict
  /// @param issHash hash if the user where the conflict occurred
  error KidAlreadyRegistered(bytes32 kid, bytes32 issHash);

  function hashIssuer(string memory iss) external pure returns (bytes32);
  function getKey(bytes32 issHash, bytes32 kid) external view returns (Key memory);
  function addKey(Key memory newKey) external;
  function addKeys(Key[] memory newKeys) external;
  function deleteKey(bytes32 issHash, bytes32 kid) external;
}
