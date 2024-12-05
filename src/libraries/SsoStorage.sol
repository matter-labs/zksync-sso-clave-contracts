// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library SsoStorage {
  bytes32 private constant SSO_STORAGE_SLOT = 0x3248da1aeae8bd923cbf26901dc4bfc6bb48bb0fbc5b6102f1151fe7012884f4;

  struct Layout {
    // ┌───────────────────┐
    // │   Ownership Data  │
    mapping(address => address) k1Owners;
    uint256[50] __gap_0;
    // └───────────────────┘

    // ┌───────────────────┐
    // │     Validation    │
    mapping(address => address) moduleValidators;
    uint256[50] __gap_2;
    // └───────────────────┘

    // ┌───────────────────┐
    // │       Hooks       │
    mapping(address => address) validationHooks;
    mapping(address => address) executionHooks;
    mapping(address => mapping(bytes32 => bytes)) hookDataStore;
    uint256[50] __gap_4;
    // └───────────────────┘
  }

  function layout() internal pure returns (Layout storage l) {
    bytes32 slot = SSO_STORAGE_SLOT;
    assembly {
      l.slot := slot
    }
  }
}
