// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract OidcKeyRegistry is Initializable, OwnableUpgradeable {
  uint8 public constant MAX_KEYS = 8;

  struct Key {
    bytes32 issHash; // Issuer
    bytes32 kid; // Key ID
    bytes n; // RSA modulus
    bytes e; // RSA exponent
  }

  Key[MAX_KEYS] public OIDCKeys;
  uint8 public keyIndex;
  bytes32 public merkleRoot;

  constructor() {
    initialize();
  }

  function initialize() public initializer {
    __Ownable_init();
    keyIndex = MAX_KEYS - 1;
  }

  function hashIssuer(string memory iss) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(iss));
  }

  function addKey(Key memory newKey) public onlyOwner {
    uint8 nextIndex = (keyIndex + 1) % MAX_KEYS; // Circular buffer

    bytes32 newLeaf = _hashKey(newKey);
    bytes32[MAX_KEYS] memory leaves;
    for (uint8 i = 0; i < MAX_KEYS; i++) {
      if (i != nextIndex) {
        leaves[i] = _hashKey(OIDCKeys[i]);
      } else {
        leaves[i] = newLeaf;
      }
    }

    bytes32 newRoot = _computeMerkleRoot(leaves);

    OIDCKeys[nextIndex] = newKey;
    keyIndex = nextIndex;
    merkleRoot = newRoot;
  }

  function addKeys(Key[] memory newKeys) public onlyOwner {
    for (uint8 i = 0; i < newKeys.length; i++) {
      uint8 nextIndex = (keyIndex + 1 + i) % MAX_KEYS; // Circular buffer
      OIDCKeys[nextIndex] = newKeys[i];
    }

    bytes32[MAX_KEYS] memory leaves;
    for (uint8 i = 0; i < MAX_KEYS; i++) {
      leaves[i] = _hashKey(OIDCKeys[i]);
    }

    bytes32 newRoot = _computeMerkleRoot(leaves);
    keyIndex = uint8((uint256(keyIndex) + newKeys.length) % uint256(MAX_KEYS));
    merkleRoot = newRoot;
  }

  function getKey(bytes32 issHash, bytes32 kid) public view returns (Key memory) {
    require(issHash != 0, "Invalid issHash");
    require(kid != 0, "Invalid kid");
    for (uint8 i = 0; i < MAX_KEYS; i++) {
      if (OIDCKeys[i].issHash == issHash && OIDCKeys[i].kid == kid) {
        return OIDCKeys[i];
      }
    }
    revert("Key not found");
  }

  function _hashKey(Key memory key) private pure returns (bytes32) {
    return keccak256(bytes.concat(keccak256(abi.encode(key.issHash, key.kid, key.n, key.e))));
  }

  function _computeMerkleRoot(bytes32[MAX_KEYS] memory leaves) private pure returns (bytes32) {
    uint256 n = leaves.length;
    while (n > 1) {
      for (uint256 i = 0; i < n / 2; i++) {
        leaves[i] = _hashPair(leaves[2 * i], leaves[2 * i + 1]);
      }
      n = n / 2;
    }
    return leaves[0];
  }

  // Taken from OpenZeppelin's MerkleProof.sol
  function _hashPair(bytes32 a, bytes32 b) private pure returns (bytes32) {
    return a < b ? _efficientHash(a, b) : _efficientHash(b, a);
  }

  function _efficientHash(bytes32 a, bytes32 b) private pure returns (bytes32 value) {
    assembly {
      mstore(0x00, a)
      mstore(0x20, b)
      value := keccak256(0x00, 0x40)
    }
  }
}
