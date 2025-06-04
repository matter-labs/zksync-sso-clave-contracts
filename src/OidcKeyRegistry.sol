// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { IOidcKeyRegistry } from "./interfaces/IOidcKeyRegistry.sol";
import { Errors } from "./libraries/Errors.sol";

/// @title OidcKeyRegistry
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev This contract is used to store OIDC keys for the OIDC recovery validator.
contract OidcKeyRegistry is IOidcKeyRegistry, Initializable, Ownable2StepUpgradeable {
  /// @dev The maximum number of keys that can be added to the registry.
  uint256 public constant MAX_KEYS = 8;

  /// @dev The number of chunks needed to represent RSA public key modulus in the ZK circuit.
  /// @dev This matches the Circom circuit's bigint configuration for RSA verification.
  uint256 public constant CIRCOM_BIGINT_CHUNKS = 17;

  /// @dev The size in bits of each chunk needed to represent RSA public key modulus in the ZK circuit.
  /// @dev This matches the Circom circuit's bigint configuration for RSA verification.
  uint256 public constant CIRCOM_BIGINT_CHUNK_SIZE = 121;

  /// @dev Max value that an rsa chunk can take. Used to validate new keys.
  uint256 private constant VALIDATE_MODULUS_LIMIT = (1 << CIRCOM_BIGINT_CHUNK_SIZE) - 1;

  /// @notice The mapping of issuer hash to keys.
  /// @dev Each issuer has an array of length MAX_KEYS, which is a circular buffer.
  mapping(bytes32 issuerHash => Key[MAX_KEYS] keys) internal OIDCKeys;

  /// @notice The index where the next key is going to be added.
  /// @dev Because keys are stored in a circular buffer this information needs to be stored.
  mapping(bytes32 issuerHash => uint256 keyIndex) internal keyIndexes;

  constructor() {
    _disableInitializers();
  }

  function initialize() external initializer {
    __Ownable_init();
  }

  /// @notice Hashes the issuer string to a bytes32 value.
  /// @param iss The issuer string to hash.
  /// @return issHash The hashed issuer.
  function hashIssuer(string memory iss) external pure returns (bytes32) {
    return keccak256(abi.encode(iss));
  }

  /// @notice Adds a batch of keys to the registry.
  /// @param newKeys The keys to add.
  function addKeys(Key[] memory newKeys) external onlyOwner {
    _addKeys(newKeys);
  }

  /// @notice Adds a single key to the registry.
  /// @param newKey The key to add.
  function addKey(Key memory newKey) external onlyOwner {
    Key[] memory newKeys = new Key[](1);
    newKeys[0] = newKey;
    _addKeys(newKeys);
  }

  /// @notice Retrieves a key from the registry.
  /// @param issHash The issuer hash.
  /// @param kid The key ID.
  /// @return key The key.
  function getKey(bytes32 issHash, bytes32 kid) external view returns (Key memory) {
    for (uint256 i = 0; i < MAX_KEYS; ++i) {
      if (OIDCKeys[issHash][i].kid == kid) {
        return OIDCKeys[issHash][i];
      }
    }
    revert Errors.OIDC_KEY_NOT_FOUND(issHash, kid);
  }

  /// @notice Retrieves all keys for a given issuer hash.
  /// @param issHash The issuer hash.
  /// @return keys The keys.
  function getKeys(bytes32 issHash) external view returns (Key[MAX_KEYS] memory) {
    return OIDCKeys[issHash];
  }

  /// @notice Deletes a key from the registry.
  /// @param issHash The issuer hash.
  /// @param kid The key ID.
  function deleteKey(bytes32 issHash, bytes32 kid) external onlyOwner {
    _deleteKey(issHash, kid);
    _compactKeys(issHash);
    emit KeyDeleted(issHash, kid);
  }

  /// @notice Adds a batch of keys to the registry.
  /// @param newKeys The keys to add.
  function _addKeys(Key[] memory newKeys) private {
    _validateKeyBatch(newKeys);
    for (uint256 i = 0; i < newKeys.length; ++i) {
      bytes32 issHash = newKeys[i].issHash;
      _ensureUniqueKid(newKeys[i].kid, issHash);
      uint256 keyIndex = keyIndexes[issHash];
      OIDCKeys[issHash][keyIndex] = newKeys[i];
      uint256 nextIndex = (keyIndex + 1) % MAX_KEYS; // Circular buffer
      keyIndexes[issHash] = nextIndex;
      emit KeyAdded(issHash, newKeys[i].kid, newKeys[i].rsaModulus);
    }
  }

  function _ensureUniqueKid(bytes32 kid, bytes32 issHash) internal view {
    for (uint256 i = 0; i < MAX_KEYS; i++) {
      if (OIDCKeys[issHash][i].kid == kid) {
        revert Errors.OIDC_KEY_ID_ALREADY_EXISTS(kid, issHash);
      }
    }
  }

  /// @notice Compacts the keys for a given issuer hash.
  /// @dev This function is called when a key is deleted from the registry.
  /// @param issHash The issuer hash.
  function _compactKeys(bytes32 issHash) private {
    Key[MAX_KEYS] memory keys;
    uint256 keyCount = 0;
    uint256 currentIndex = keyIndexes[issHash];

    // Collect non-empty keys in order
    // At the end of this loop `keyCount` it's in the currentIndex
    // for the next key.
    for (uint256 i = 0; i < MAX_KEYS; ++i) {
      uint256 circularIndex = (currentIndex + i) % MAX_KEYS;
      if (OIDCKeys[issHash][circularIndex].kid != 0) {
        keys[keyCount] = OIDCKeys[issHash][circularIndex];
        keyCount++;
      }
    }

    // Reassign the collected keys in order back to storage
    for (uint256 i = 0; i < keyCount; ++i) {
      OIDCKeys[issHash][i] = keys[i];
    }

    // Delete remaining keys that are no longer needed
    for (uint256 i = keyCount; i < MAX_KEYS; ++i) {
      delete OIDCKeys[issHash][i];
    }

    keyIndexes[issHash] = keyCount % MAX_KEYS;
  }

  /// @notice Deletes a key from the registry.
  /// @param issHash The issuer hash.
  /// @param kid The key ID.
  function _deleteKey(bytes32 issHash, bytes32 kid) private {
    for (uint256 i = 0; i < MAX_KEYS; ++i) {
      if (OIDCKeys[issHash][i].kid == kid) {
        delete OIDCKeys[issHash][i];
        return;
      }
    }
    revert Errors.OIDC_KEY_NOT_FOUND(issHash, kid);
  }

  /// @notice Validates a batch of keys.
  /// @dev This function is called when a batch of keys is added to the registry.
  /// @dev It validates that only one issuer is added per batch.
  /// @dev It validates that the key ID is not zero.
  /// @dev It validates that the exponent is not zero.
  /// @dev It validates that the modulus is not zero.
  /// @dev It validates that the modulus chunks are not bigger than 121 bits.
  /// @param newKeys The keys to validate.
  function _validateKeyBatch(Key[] memory newKeys) private pure {
    if (newKeys.length > MAX_KEYS) {
      revert Errors.OIDC_KEY_COUNT_LIMIT_EXCEEDED(newKeys.length);
    }
    if (newKeys.length == 0) {
      return;
    }
    bytes32 issHash = newKeys[0].issHash;
    for (uint256 i = 0; i < newKeys.length; ++i) {
      if (newKeys[i].issHash != issHash) {
        revert Errors.OIDC_ISSUER_HASH_MISMATCH(issHash, newKeys[i].issHash);
      }

      if (newKeys[i].kid == 0) {
        revert Errors.OIDC_ZERO_KEY_ID(i);
      }

      _validateModulus(newKeys[i].rsaModulus, newKeys[i].kid);
    }
  }

  /// @notice Checks if the exponent is not zero.
  /// @dev This function is called when a batch of keys is added to the registry.
  /// @param exponent The exponent to check.
  /// @return hasNonZeroExponent True if the exponent is not zero, false otherwise.
  function _hasNonZeroExponent(bytes memory exponent) private pure returns (bool) {
    for (uint256 i = 0; i < exponent.length; ++i) {
      if (exponent[i] != 0) {
        return true;
      }
    }
    return false;
  }

  /// @notice Validates the modulus.
  /// @dev This function is called when a key is added to the registry.
  /// @dev It validates that the modulus is not zero.
  /// @dev It validates that the modulus chunks are not bigger than 121 bits.
  /// @param modulus The modulus to validate.
  /// @param kid The id of the key in the batch being validated.
  function _validateModulus(uint256[CIRCOM_BIGINT_CHUNKS] memory modulus, bytes32 kid) private pure {
    bool hasNonZero = false;

    for (uint256 i = 0; i < CIRCOM_BIGINT_CHUNKS; ++i) {
      if (modulus[i] > VALIDATE_MODULUS_LIMIT) {
        revert Errors.OIDC_MODULUS_CHUNK_TOO_LARGE(kid, i, modulus[i]);
      }
      if (modulus[i] != 0) {
        hasNonZero = true;
      }
    }

    if (!hasNonZero) {
      revert Errors.OIDC_ZERO_MODULUS(kid);
    }

    if (modulus[0] % 2 == 0) {
      revert Errors.OIDC_EVEN_RSA_MODULUS(kid);
    }
  }
}
