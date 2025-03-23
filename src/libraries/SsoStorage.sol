// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

library SsoStorage {
  // @custom:storage-location erc7201:zksync-sso.contracts.SsoStorage
  bytes32 private constant SSO_STORAGE_SLOT = 0x76d91304710525fd07f6da5fffdfa69dbbabd80bc84f808f10d120a9bbff4600;

  struct Layout {
    // Ownership Data
    EnumerableSet.AddressSet k1Owners;
    // Validation
    EnumerableSet.AddressSet moduleValidators;
    // Hooks
    EnumerableSet.AddressSet validationHooks;
    EnumerableSet.AddressSet executionHooks;
    // Storage slots reserved for future upgrades
    uint256[256] __RESERVED;
  }

  function layout() internal pure returns (Layout storage l) {
    bytes32 slot = SSO_STORAGE_SLOT;
    assembly {
      l.slot := slot
    }
  }

  function validators() internal view returns (EnumerableSet.AddressSet storage) {
    return layout().moduleValidators;
  }

  function validationHooks() internal view returns (EnumerableSet.AddressSet storage) {
    return layout().validationHooks;
  }

  function executionHooks() internal view returns (EnumerableSet.AddressSet storage) {
    return layout().executionHooks;
  }
}
