// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

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

  constructor() {
    initialize();
  }

  function initialize() public initializer {
    __Ownable_init();
  }

  function hashIssuer(string memory iss) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(iss));
  }

  function addKey(Key memory key) public onlyOwner {
    uint8 nextIndex = (keyIndex + 1) % MAX_KEYS; // Circular buffer
    OIDCKeys[nextIndex] = key;
    keyIndex = nextIndex;
  }

  function addKeys(Key[] memory keys) public onlyOwner {
    for (uint8 i = 0; i < keys.length; i++) {
      addKey(keys[i]);
    }
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
}
