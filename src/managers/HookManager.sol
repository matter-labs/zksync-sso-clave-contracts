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
import { IHookManager } from "../interfaces/IHookManager.sol";
import { IModule } from "../interfaces/IModule.sol";

/**
 * @title Manager contract for hooks
 * @notice Abstract contract for managing the enabled hooks of the account
 * @author https://getclave.io
 */
abstract contract HookManager is IHookManager, Auth {
  using EnumerableSet for EnumerableSet.AddressSet;
  // Interface helper library
  using ERC165Checker for address;
  // Low level calls helper library
  using ExcessivelySafeCall for address;

  /// @inheritdoc IHookManager
  function addHook(address hook, bytes calldata initData) external override onlySelf {
    _addHook(hook);
    IModule(hook).onInstall(initData);
  }

  /// @inheritdoc IHookManager
  function removeHook(address hook, bytes calldata deinitData) external override onlySelf {
    _removeHook(hook);
    IModule(hook).onUninstall(deinitData);
  }

  /// @inheritdoc IHookManager
  function unlinkHook(address hook, bytes calldata deinitData) external onlySelf {
    _removeHook(hook);
    hook.excessivelySafeCall(gasleft(), 0, abi.encodeWithSelector(IModule.onUninstall.selector, deinitData));
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

  function _addHook(address hook) internal {
    bool isExecutionHook = hook.supportsInterface(type(IExecutionHook).interfaceId);
    bool isValidationHook = hook.supportsInterface(type(IValidationHook).interfaceId);
    if (!isExecutionHook && !isValidationHook) {
      revert Errors.HOOK_ERC165_FAIL(hook);
    }
    if (isValidationHook) {
      require(_validationHooks().add(hook), "Validation hook already exists");
    }
    if (isExecutionHook) {
      require(_executionHooks().add(hook), "Execution hook already exists");
    }

    emit HookAdded(hook);
  }

  function _removeHook(address hook) internal {
    if (_validationHooks().contains(hook)) {
      require(_validationHooks().remove(hook), "Validation hook not found");
    }

    if (_executionHooks().contains(hook)) {
      require(_executionHooks().remove(hook), "Execution hook not found");
    }

    emit HookRemoved(hook);
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
}
