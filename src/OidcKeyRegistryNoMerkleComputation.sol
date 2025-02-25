// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract OidcKeyRegistryNoMerkleComputation is Initializable, OwnableUpgradeable {
  uint8 public constant MAX_KEYS = 8;
  bytes32 public merkleRoot; // Merkle root should be on slot 1

  struct Key {
    bytes32 issHash; // Issuer
    bytes32 kid; // Key ID
    bytes n; // RSA modulus
    bytes e; // RSA exponent
  }

  Key[MAX_KEYS] public OIDCKeys;
  uint8 public keyIndex;

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

  function addKey(Key memory newKey, bytes32 root) public onlyOwner {
    Key[] memory newKeys = new Key[](1);
    newKeys[0] = newKey;
    addKeys(newKeys, root);
  }

  function addKeys(Key[] memory newKeys, bytes32 root) public onlyOwner {
    for (uint8 i = 0; i < newKeys.length; i++) {
      uint8 nextIndex = (keyIndex + 1 + i) % MAX_KEYS; // Circular buffer
      OIDCKeys[nextIndex] = newKeys[i];
    }

    merkleRoot = root;
    keyIndex = uint8((uint256(keyIndex) + newKeys.length) % uint256(MAX_KEYS));
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

  function verifyKey(Key memory key, bytes32[] memory proof) public view returns (bool) {
    bytes32 leaf = _hashKey(key);
    return MerkleProof.verify(proof, merkleRoot, leaf);
  }

  function _hashKey(Key memory key) private pure returns (bytes32) {
    return keccak256(bytes.concat(keccak256(abi.encode(key.issHash, key.kid, key.n, key.e))));
  }
}
