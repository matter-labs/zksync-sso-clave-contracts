// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @title OidcKeyRegistry
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev This contract is used to store OIDC keys for the OIDC recovery validator.
contract OidcKeyRegistry is Initializable, OwnableUpgradeable {
  uint8 public constant MAX_KEYS = 8;
  // Number of 128-bit chunks needed to represent RSA public key modulus in the ZK circuit
  // This matches the Circom circuit's bigint configuration for RSA verification
  uint8 public constant CIRCOM_BIGINT_CHUNKS = 17;

  struct Key {
    bytes32 issHash; // Issuer
    bytes32 kid; // Key ID
    uint256[CIRCOM_BIGINT_CHUNKS] n; // RSA modulus
    bytes e; // RSA exponent
  }

  event KeyAdded(bytes32 indexed issHash, bytes32 indexed kid, uint256[CIRCOM_BIGINT_CHUNKS] n);
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
  error KeyIdCannotBeZero(uint8 index);

  /// @notice Thrown when the exponent is zero, which is not allowed.
  /// @param index The index of the key in the batch being validated.
  error ExponentCannotBeZero(uint8 index);

  /// @notice Thrown when the modulus is zero, which is not allowed.
  /// @param index The index of the key in the batch being validated.
  error ModulusCannotBeZero(uint8 index);

  /// @notice Thrown when a modulus chunk exceeds the maximum allowed size of 121 bits.
  /// @param index The index of the key in the batch being validated.
  /// @param chunkIndex The index of the chunk that exceeded the limit.
  /// @param chunkValue The value of the chunk that exceeded the limit.
  error ModulusChunkTooLarge(uint8 index, uint256 chunkIndex, uint256 chunkValue);

  // Mapping of issuer hash to keys
  mapping(bytes32 issHash => Key[MAX_KEYS] keys) public OIDCKeys;
  // Index of the last key added per issuer
  mapping(bytes32 issHash => uint8 keyIndex) public keyIndexes;

  constructor() {
    _disableInitializers();
  }

  function initialize() external initializer {
    __Ownable_init();
  }

  function hashIssuer(string memory iss) external pure returns (bytes32) {
    return keccak256(abi.encode(iss));
  }

  function addKeys(Key[] memory newKeys) external onlyOwner {
    _addKeys(newKeys);
  }

  function addKey(Key memory newKey) external onlyOwner {
    Key[] memory newKeys = new Key[](1);
    newKeys[0] = newKey;
    _addKeys(newKeys);
  }

  function getKey(bytes32 issHash, bytes32 kid) external view returns (Key memory) {
    for (uint8 i = 0; i < MAX_KEYS; ++i) {
      if (OIDCKeys[issHash][i].kid == kid) {
        return OIDCKeys[issHash][i];
      }
    }
    revert KeyNotFound(issHash, kid);
  }

  function getKeys(bytes32 issHash) external view returns (Key[MAX_KEYS] memory) {
    return OIDCKeys[issHash];
  }

  function deleteKey(bytes32 issHash, bytes32 kid) external onlyOwner {
    _deleteKey(issHash, kid);
    _compactKeys(issHash);
    emit KeyDeleted(issHash, kid);
  }

  function _addKeys(Key[] memory newKeys) private {
    _validateKeyBatch(newKeys);
    for (uint8 i = 0; i < newKeys.length; ++i) {
      bytes32 issHash = newKeys[i].issHash;
      uint8 keyIndex = keyIndexes[issHash];
      uint8 nextIndex = (keyIndex + 1) % MAX_KEYS; // Circular buffer
      OIDCKeys[issHash][nextIndex] = newKeys[i];
      keyIndexes[issHash] = nextIndex;
      emit KeyAdded(issHash, newKeys[i].kid, newKeys[i].n);
    }
  }

  function _compactKeys(bytes32 issHash) private {
    Key[MAX_KEYS] memory keys;
    uint8 keyCount = 0;
    uint8 currentIndex = keyIndexes[issHash];

    // Collect non-empty keys in order
    for (uint8 i = 0; i < MAX_KEYS; ++i) {
      uint8 circularIndex = (currentIndex + i) % MAX_KEYS;
      if (OIDCKeys[issHash][circularIndex].kid != 0) {
        keys[keyCount] = OIDCKeys[issHash][circularIndex];
        keyCount++;
      }
    }

    // Reassign the collected keys in order back to storage
    for (uint8 i = 0; i < keyCount; ++i) {
      OIDCKeys[issHash][i] = keys[i];
    }

    // Delete remaining keys that are no longer needed
    for (uint8 i = keyCount; i < MAX_KEYS; ++i) {
      delete OIDCKeys[issHash][i];
    }

    // Adding MAX_KEYS to avoid underflow
    keyIndexes[issHash] = (keyCount + MAX_KEYS - 1) % MAX_KEYS;
  }

  function _deleteKey(bytes32 issHash, bytes32 kid) private {
    for (uint8 i = 0; i < MAX_KEYS; ++i) {
      if (OIDCKeys[issHash][i].kid == kid) {
        delete OIDCKeys[issHash][i];
        return;
      }
    }
    revert KeyNotFound(issHash, kid);
  }

  function _validateKeyBatch(Key[] memory newKeys) private pure {
    if (newKeys.length > MAX_KEYS) {
      revert KeyCountLimitExceeded(newKeys.length);
    }
    if (newKeys.length == 0) {
      return;
    }
    bytes32 issHash = newKeys[0].issHash;
    for (uint8 i = 0; i < newKeys.length; ++i) {
      if (newKeys[i].issHash != issHash) {
        revert IssuerHashMismatch(issHash, newKeys[i].issHash);
      }

      if (newKeys[i].kid == 0) {
        revert KeyIdCannotBeZero(i);
      }

      if (!_hasNonZeroExponent(newKeys[i].e)) {
        revert ExponentCannotBeZero(i);
      }

      _validateModulus(newKeys[i].n, i);
    }
  }

  function _hasNonZeroExponent(bytes memory exponent) private pure returns (bool) {
    for (uint256 i = 0; i < exponent.length; ++i) {
      if (exponent[i] != 0) {
        return true;
      }
    }
    return false;
  }

  function _validateModulus(uint256[CIRCOM_BIGINT_CHUNKS] memory modulus, uint8 index) private pure {
    uint256 limit = (1 << 121) - 1;
    bool hasNonZero = false;

    for (uint8 i = 0; i < CIRCOM_BIGINT_CHUNKS; ++i) {
      if (modulus[i] > limit) {
        revert ModulusChunkTooLarge(index, i, modulus[i]);
      }
      if (modulus[i] != 0) {
        hasNonZero = true;
      }
    }

    if (!hasNonZero) {
      revert ModulusCannotBeZero(index);
    }
  }
}
