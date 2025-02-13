// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { SsoStorage } from "../libraries/SsoStorage.sol";
import { Errors } from "../libraries/Errors.sol";
import { SelfAuth } from "../auth/SelfAuth.sol";
import { IOwnerManager } from "../interfaces/IOwnerManager.sol";

/**
 * @title Manager contract for owners
 * @notice Abstract contract for managing the owners of the account
 * @dev K1 Owners are secp256k1 addresses
 * @dev Owners are stored in an enumerable set
 * @author https://getclave.io
 */
abstract contract OwnerManager is IOwnerManager, SelfAuth {
  using EnumerableSet for EnumerableSet.AddressSet;

  /// @inheritdoc IOwnerManager
  function k1AddOwner(address addr) external override onlySelf {
    _k1AddOwner(addr);
  }

  /// @inheritdoc IOwnerManager
  function k1RemoveOwner(address addr) external override onlySelf {
    _k1RemoveOwner(addr);
  }

  /// @inheritdoc IOwnerManager
  function k1IsOwner(address addr) external view override returns (bool) {
    return _k1IsOwner(addr);
  }

  /// @inheritdoc IOwnerManager
  function k1ListOwners() external view override returns (address[] memory k1OwnerList) {
    k1OwnerList = _k1Owners().values();
  }

  // Should not be set to private as it is called from SsoAccount's initialize
  function _k1AddOwner(address addr) internal {
    require(_k1Owners().add(addr), "K1 owner already exists");

    emit K1OwnerAdded(addr);
  }

  function _k1RemoveOwner(address addr) private {
    require(_k1Owners().remove(addr), "K1 owner not found");

    emit K1OwnerRemoved(addr);
  }

  function _k1IsOwner(address addr) internal view returns (bool) {
    return _k1Owners().contains(addr);
  }

  function _k1Owners() private view returns (EnumerableSet.AddressSet storage k1Owners) {
    k1Owners = SsoStorage.layout().k1Owners;
  }
}
