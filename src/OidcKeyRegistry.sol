// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

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

  event KeyAdded(bytes32 indexed issHash, bytes32 indexed kid, uint8 index);
  event KeyDeleted(bytes32 indexed issHash, bytes32 indexed kid);

  // Mapping of issuer hash to keys
  mapping(bytes32 => Key[MAX_KEYS]) public OIDCKeys;
  // Index of the last key added per issuer
  mapping(bytes32 => uint8) public keyIndexes;

  constructor() {
    initialize();
  }

  function initialize() public initializer {
    __Ownable_init();
  }

  function hashIssuer(string memory iss) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(iss));
  }

  function addKey(Key memory newKey) public onlyOwner {
    Key[] memory newKeys = new Key[](1);
    newKeys[0] = newKey;
    addKeys(newKeys);
  }

  function addKeys(Key[] memory newKeys) public onlyOwner {
    _checkKeyCountLimit(newKeys);
    for (uint8 i = 0; i < newKeys.length; i++) {
      bytes32 issHash = newKeys[i].issHash;
      uint8 keyIndex = keyIndexes[issHash];
      uint8 nextIndex = (keyIndex + 1) % MAX_KEYS; // Circular buffer
      OIDCKeys[issHash][nextIndex] = newKeys[i];
      keyIndexes[issHash] = nextIndex;
      emit KeyAdded(issHash, newKeys[i].kid, nextIndex);
    }
  }

  function getKey(bytes32 issHash, bytes32 kid) public view returns (Key memory) {
    for (uint8 i = 0; i < MAX_KEYS; i++) {
      if (OIDCKeys[issHash][i].kid == kid) {
        return OIDCKeys[issHash][i];
      }
    }
    revert("Key not found");
  }

  function getKeys(bytes32 issHash) public view returns (Key[MAX_KEYS] memory) {
    return OIDCKeys[issHash];
  }

  function deleteKey(bytes32 issHash, bytes32 kid) public onlyOwner {
    _deleteKey(issHash, kid);
    _compactKeys(issHash);
    emit KeyDeleted(issHash, kid);
  }

  function _compactKeys(bytes32 issHash) private {
    Key[MAX_KEYS] memory keys;
    uint8 keyCount = 0;
    uint8 currentIndex = keyIndexes[issHash];

    for (uint8 i = 0; i < MAX_KEYS; i++) {
      uint8 circularIndex = (currentIndex + i) % MAX_KEYS;
      if (OIDCKeys[issHash][circularIndex].kid != 0) {
        keys[keyCount] = OIDCKeys[issHash][circularIndex];
        keyCount++;
      }
    }

    for (uint8 i = 0; i < keyCount; i++) {
      OIDCKeys[issHash][i] = keys[i];
    }

    for (uint8 i = keyCount; i < MAX_KEYS; i++) {
      delete OIDCKeys[issHash][i];
    }

    // Adding MAX_KEYS to take adventage of modulus and avoid overflow
    keyIndexes[issHash] = (keyCount + MAX_KEYS - 1) % MAX_KEYS;
  }

  function _deleteKey(bytes32 issHash, bytes32 kid) private {
    for (uint8 i = 0; i < MAX_KEYS; i++) {
      if (OIDCKeys[issHash][i].kid == kid) {
        delete OIDCKeys[issHash][i];
        return;
      }
    }
    revert("Key not found");
  }

  function _checkKeyCountLimit(Key[] memory newKeys) private pure {
    require(newKeys.length <= MAX_KEYS, "Key count limit exceeded");
    if (newKeys.length == 0) {
      return;
    }
    bytes32 issHash = newKeys[0].issHash;
    for (uint8 i = 1; i < newKeys.length; i++) {
      require(newKeys[i].issHash == issHash, "Issuer hash mismatch: All keys must have the same issuer");
    }
  }
}
