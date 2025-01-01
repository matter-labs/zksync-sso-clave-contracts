// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { Errors } from "../libraries/Errors.sol";

/**
 * @title Address linked list library
 * @notice Helper library for address linkedlist operations
 */
library AddressLinkedList {
  address internal constant SENTINEL_ADDRESS = address(1);

  modifier validAddress(address value) {
    if (value <= SENTINEL_ADDRESS) {
      revert Errors.INVALID_ADDRESS(value);
    }
    _;
  }

  function add(mapping(address => address) storage self, address value) internal validAddress(value) {
    if (self[value] != address(0)) {
      revert Errors.ADDRESS_ALREADY_EXISTS(value);
    }

    address prev = self[SENTINEL_ADDRESS];
    if (prev == address(0)) {
      self[SENTINEL_ADDRESS] = value;
      self[value] = SENTINEL_ADDRESS;
    } else {
      self[SENTINEL_ADDRESS] = value;
      self[value] = prev;
    }
  }

  function replace(mapping(address => address) storage self, address oldValue, address newValue) internal {
    if (!exists(self, oldValue)) {
      revert Errors.ADDRESS_NOT_EXISTS(oldValue);
    }
    if (exists(self, newValue)) {
      revert Errors.ADDRESS_ALREADY_EXISTS(newValue);
    }

    address cursor = SENTINEL_ADDRESS;
    while (true) {
      address _value = self[cursor];
      if (_value == oldValue) {
        address next = self[_value];
        self[newValue] = next;
        self[cursor] = newValue;
        delete self[_value];
        return;
      }
      cursor = _value;
    }
  }

  function replaceUsingPrev(
    mapping(address => address) storage self,
    address prevValue,
    address oldValue,
    address newValue
  ) internal {
    if (!exists(self, oldValue)) {
      revert Errors.ADDRESS_NOT_EXISTS(oldValue);
    }
    if (exists(self, newValue)) {
      revert Errors.ADDRESS_ALREADY_EXISTS(newValue);
    }
    if (self[prevValue] != oldValue) {
      revert Errors.INVALID_PREV_ADDR(self[prevValue], oldValue);
    }

    self[newValue] = self[oldValue];
    self[prevValue] = newValue;
    delete self[oldValue];
  }

  function remove(mapping(address => address) storage self, address value) internal {
    if (!exists(self, value)) {
      revert Errors.ADDRESS_NOT_EXISTS(value);
    }

    address cursor = SENTINEL_ADDRESS;
    while (true) {
      address _value = self[cursor];
      if (_value == value) {
        address next = self[_value];
        self[cursor] = next;
        delete self[_value];
        return;
      }
      cursor = _value;
    }
  }

  function removeUsingPrev(mapping(address => address) storage self, address prevValue, address value) internal {
    if (!exists(self, value)) {
      revert Errors.ADDRESS_NOT_EXISTS(value);
    }
    if (self[prevValue] != value) {
      revert Errors.INVALID_PREV_ADDR(self[prevValue], value);
    }

    self[prevValue] = self[value];
    delete self[value];
  }

  function clear(mapping(address => address) storage self) internal {
    address cursor = SENTINEL_ADDRESS;
    do {
      address nextCursor = self[cursor];
      delete self[cursor];
      cursor = nextCursor;
    } while (cursor > SENTINEL_ADDRESS);
  }

  function exists(
    mapping(address => address) storage self,
    address value
  ) internal view validAddress(value) returns (bool) {
    return self[value] != address(0);
  }

  function size(mapping(address => address) storage self) internal view returns (uint256) {
    uint256 result = 0;
    address cursor = self[SENTINEL_ADDRESS];
    while (cursor > SENTINEL_ADDRESS) {
      cursor = self[cursor];
      unchecked {
        result++;
      }
    }
    return result;
  }

  function isEmpty(mapping(address => address) storage self) internal view returns (bool) {
    return self[SENTINEL_ADDRESS] <= SENTINEL_ADDRESS;
  }

  function list(mapping(address => address) storage self) internal view returns (address[] memory) {
    uint256 _size = size(self);
    address[] memory result = new address[](_size);
    uint256 i = 0;
    address cursor = self[SENTINEL_ADDRESS];
    while (cursor > SENTINEL_ADDRESS) {
      result[i] = cursor;
      cursor = self[cursor];
      unchecked {
        i++;
      }
    }

    return result;
  }
}
