// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract OidcKeyRegistry is Initializable, OwnableUpgradeable {
  uint8 public constant MAX_KEYS = 5;

  struct Key {
    bytes32 kid; // Key ID
    bytes n; // RSA modulus
    bytes e; // RSA exponent
  }

  // Mapping uses keccak256(iss) as the key
  mapping(bytes32 => Key[MAX_KEYS]) public OIDCKeys; // Stores up to MAX_KEYS per issuer
  mapping(bytes32 => uint8) public keyIndexes; // Tracks the latest key index for each issuer

  constructor() {
    initialize();
  }

  function initialize() public initializer {
    __Ownable_init();
  }

  function hashIssuer(string memory iss) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(iss));
  }

  function setKey(bytes32 issHash, Key memory key) public onlyOwner {
    uint8 index = keyIndexes[issHash];
    uint8 nextIndex = (index + 1) % MAX_KEYS; // Circular buffer
    OIDCKeys[issHash][nextIndex] = key;
    keyIndexes[issHash] = nextIndex;
  }

  function setKeys(bytes32 issHash, Key[] memory keys) public onlyOwner {
    for (uint8 i = 0; i < keys.length; i++) {
      setKey(issHash, keys[i]);
    }
  }

  function getKey(bytes32 issHash, bytes32 kid) public view returns (Key memory) {
    require(kid != 0, "Invalid kid");
    Key[MAX_KEYS] storage keys = OIDCKeys[issHash];
    for (uint8 i = 0; i < MAX_KEYS; i++) {
      if (keys[i].kid == kid) {
        return keys[i];
      }
    }
    revert("Key not found");
  }
}
