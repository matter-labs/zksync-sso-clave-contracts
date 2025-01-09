// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ERC165Checker } from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { ExcessivelySafeCall } from "@nomad-xyz/excessively-safe-call/src/ExcessivelySafeCall.sol";

import { Auth } from "../auth/Auth.sol";
import { SsoStorage } from "../libraries/SsoStorage.sol";
import { Errors } from "../libraries/Errors.sol";
import { IExecutionHook, IValidationHook } from "../interfaces/IHook.sol";
import { IInitable } from "../interfaces/IInitable.sol";
import { IHookManager } from "../interfaces/IHookManager.sol";

/**
 * @title Manager contract for hooks
 * @notice Abstract contract for managing the enabled hooks of the account
 * @dev Hook addresses are stored in a linked list
 * @author https://getclave.io
 */
abstract contract HookManager is IHookManager, Auth {
  using EnumerableSet for EnumerableSet.AddressSet;
  // Interface helper library
  using ERC165Checker for address;
  // Low level calls helper library
  using ExcessivelySafeCall for address;

  // Slot for execution hooks to store context
  bytes32 private constant CONTEXT_KEY = keccak256("HookManager.context");
  error HookPostCheckFailed();
  error HookAlreadyInstalled(address currentHook);

  /// @inheritdoc IHookManager
  function addHook(bytes calldata hookAndData, bool isValidation) external override onlySelf {
    _addHook(hookAndData, isValidation);
  }

  /// @inheritdoc IHookManager
  function removeHook(address hook, bool isValidation) external override onlySelf {
    _removeHook(hook, isValidation);
  }

  /// @inheritdoc IHookManager
  function isHook(address addr) external view override returns (bool) {
    return _isHook(addr);
  }

  /// @inheritdoc IHookManager
  function listHooks(bool isValidation) external view override returns (address[] memory hookList) {
    if (isValidation) {
      hookList = _validationHooks().values();
    } else {
      hookList = _executionHooks().values();
    }
  }

  // Runs the validation hooks that are enabled by the account and returns true if none reverts
  function runValidationHooks(bytes32 signedHash, Transaction calldata transaction) internal returns (bool) {
    EnumerableSet.AddressSet storage hookList = _validationHooks();
    uint256 totalHooks = hookList.length();

    for (uint256 i = 0; i < totalHooks; i++) {
      bool success = _call(hookList.at(i), abi.encodeCall(IValidationHook.validationHook, (signedHash, transaction)));

      if (!success) {
        return false;
      }
    }

    return true;
  }

  // Runs the execution hooks that are enabled by the account before and after _executeTransaction
  modifier runExecutionHooks(Transaction calldata transaction) {
    EnumerableSet.AddressSet storage hookList = _executionHooks();
    uint256 totalHooks = hookList.length();

    for (uint256 i = 0; i < totalHooks; i++) {
      IExecutionHook(hookList.at(i)).preExecutionHook(transaction);
    }

    _;

    for (uint256 i = 0; i < totalHooks; i++) {
      IExecutionHook(hookList.at(i)).postExecutionHook();
    }
  }

  function _addHook(bytes calldata hookAndData, bool isValidation) private {
    if (hookAndData.length < 20) {
      revert Errors.EMPTY_HOOK_ADDRESS(hookAndData.length);
    }

    address hookAddress = address(bytes20(hookAndData[0:20]));

    bytes calldata initData = hookAndData[20:];

    _installHook(hookAddress, initData, isValidation);
  }

  function _installHook(address hookAddress, bytes memory initData, bool isValidation) internal {
    if (!_supportsHook(hookAddress, isValidation)) {
      revert Errors.HOOK_ERC165_FAIL(hookAddress, isValidation);
    }

    if (isValidation) {
      _validationHooks().add(hookAddress);
    } else {
      _executionHooks().add(hookAddress);
    }

    IInitable(hookAddress).init(initData);

    emit AddHook(hookAddress);
  }

  function _removeHook(address hook, bool isValidation) private {
    if (isValidation) {
      _validationHooks().remove(hook);
    } else {
      _executionHooks().remove(hook);
    }

    hook.excessivelySafeCall(gasleft(), 0, abi.encodeWithSelector(IInitable.disable.selector));

    emit RemoveHook(hook);
  }

  function _isHook(address addr) internal view override returns (bool) {
    return _validationHooks().contains(addr) || _executionHooks().contains(addr);
  }

  function _call(address target, bytes memory data) private returns (bool success) {
    assembly ("memory-safe") {
      success := call(gas(), target, 0, add(data, 0x20), mload(data), 0, 0)
    }
  }

  function _validationHooks() private view returns (EnumerableSet.AddressSet storage validationHooks) {
    validationHooks = SsoStorage.layout().validationHooks;
  }

  function _executionHooks() private view returns (EnumerableSet.AddressSet storage executionHooks) {
    executionHooks = SsoStorage.layout().executionHooks;
  }

  function _supportsHook(address hook, bool isValidation) private view returns (bool) {
    return
      isValidation
        ? hook.supportsInterface(type(IValidationHook).interfaceId)
        : hook.supportsInterface(type(IExecutionHook).interfaceId);
  }
}
