// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "hardhat/console.sol";

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
    return keccak256(abi.encode(iss));
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
}
