// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { SsoStorage } from "../libraries/SsoStorage.sol";
import { AddressLinkedList } from "../libraries/LinkedList.sol";
import { Errors } from "../libraries/Errors.sol";
import { Auth } from "../auth/Auth.sol";
import { ISsoAccount } from "../interfaces/ISsoAccount.sol";
import { IOwnerManager } from "../interfaces/IOwnerManager.sol";

/**
 * @title Manager contract for owners
 * @notice Abstract contract for managing the owners of the account
 * @dev K1 Owners are secp256k1 addresses
 * @dev Owners are stored in a linked list
 * @author https://getclave.io
 */
abstract contract OwnerManager is IOwnerManager, Auth {
  // Helper library for address to address mappings
  using AddressLinkedList for mapping(address => address);

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
    k1OwnerList = _k1OwnersLinkedList().list();
  }

  function _k1AddOwner(address addr) internal {
    _k1OwnersLinkedList().add(addr);

    emit K1AddOwner(addr);
  }

  function _k1RemoveOwner(address addr) internal {
    _k1OwnersLinkedList().remove(addr);

    emit K1RemoveOwner(addr);
  }

  function _k1IsOwner(address addr) internal view returns (bool) {
    return _k1OwnersLinkedList().exists(addr);
  }

  function _k1OwnersLinkedList() private view returns (mapping(address => address) storage k1Owners) {
    k1Owners = SsoStorage.layout().k1Owners;
  }

  function _k1ClearOwners() private {
    _k1OwnersLinkedList().clear();
  }
}
