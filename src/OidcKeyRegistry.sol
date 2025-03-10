// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "hardhat/console.sol";

contract OidcKeyRegistry is Initializable, OwnableUpgradeable {
  uint8 public constant MAX_KEYS = 8;
  // Merkle root is used to validate externally provided keys during transaction validation,
  // as only this storage slot is accessible in the validation step due to EIP-7562 validation rules
  // (see: https://eips.ethereum.org/EIPS/eip-7562#validation-rules).
  // This enables key verification without requiring access to the full key registry.
  // Merkle root should be on slot 1
  bytes32 public merkleRoot;
  // Number of 128-bit chunks needed to represent RSA public key modulus in the ZK circuit
  // This matches the Circom circuit's bigint configuration for RSA verification
  uint8 public constant CIRCOM_BIGINT_CHUNKS = 17;

  struct Key {
    bytes32 issHash; // Issuer
    bytes32 kid; // Key ID
    uint256[CIRCOM_BIGINT_CHUNKS] n; // RSA modulus
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

  function addKey(Key memory newKey) public onlyOwner {
    Key[] memory newKeys = new Key[](1);
    newKeys[0] = newKey;
    addKeys(newKeys);
  }

  function addKeys(Key[] memory newKeys) public onlyOwner {
    uint8 nextIndex = keyIndex;
    for (uint8 i = 0; i < newKeys.length; i++) {
      nextIndex = (keyIndex + 1 + i) % MAX_KEYS; // Circular buffer
      OIDCKeys[nextIndex] = newKeys[i];
    }

    _updateMerkleRoot();
    keyIndex = nextIndex;
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

  function getKeys() public view returns (Key[MAX_KEYS] memory) {
    return OIDCKeys;
  }

  function verifyKey(Key memory key, bytes32[] memory proof) public view returns (bool) {
    bytes32 leaf = _hashKey(key);
    return MerkleProof.verify(proof, merkleRoot, leaf);
  }

  function _updateMerkleRoot() private {
    bytes32[MAX_KEYS] memory leaves;
    for (uint8 i = 0; i < MAX_KEYS; i++) {
      leaves[i] = _hashKey(OIDCKeys[i]);
    }
    merkleRoot = _computeMerkleRoot(leaves);
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
