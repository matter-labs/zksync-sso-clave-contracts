// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ERC165Checker } from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { ExcessivelySafeCall } from "@nomad-xyz/excessively-safe-call/src/ExcessivelySafeCall.sol";

import { Auth } from "../auth/Auth.sol";
import { SsoStorage } from "../libraries/SsoStorage.sol";
import { AddressLinkedList } from "../libraries/LinkedList.sol";
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
  // Helper library for address to address mappings
  using AddressLinkedList for mapping(address => address);
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
      hookList = _validationHooksLinkedList().list();
    } else {
      hookList = _executionHooksLinkedList().list();
    }
  }

  // Runs the validation hooks that are enabled by the account and returns true if none reverts
  function runValidationHooks(bytes32 signedHash, Transaction calldata transaction) internal returns (bool) {
    address[] memory hookList = _validationHooksLinkedList().list();
    uint256 totalHooks = hookList.length;

    for (uint256 i = 0; i < totalHooks; i++) {
      bool success = _call(hookList[i], abi.encodeCall(IValidationHook.validationHook, (signedHash, transaction)));

      if (!success) {
        return false;
      }
    }

    return true;
  }

  // Runs the execution hooks that are enabled by the account before and after _executeTransaction
  modifier runExecutionHooks(Transaction calldata transaction) {
    address[] memory hookList = _executionHooksLinkedList().list();
    uint256 totalHooks = hookList.length;

    for (uint256 i = 0; i < totalHooks; i++) {
      IExecutionHook(hookList[i]).preExecutionHook(transaction);
    }

    _;

    for (uint256 i = 0; i < totalHooks; i++) {
      IExecutionHook(hookList[i]).postExecutionHook();
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
      _validationHooksLinkedList().add(hookAddress);
    } else {
      _executionHooksLinkedList().add(hookAddress);
    }

    IInitable(hookAddress).init(initData);

    emit AddHook(hookAddress);
  }

  function _removeHook(address hook, bool isValidation) private {
    if (isValidation) {
      _validationHooksLinkedList().remove(hook);
    } else {
      _executionHooksLinkedList().remove(hook);
    }

    hook.excessivelySafeCall(gasleft(), 0, abi.encodeWithSelector(IInitable.disable.selector));

    emit RemoveHook(hook);
  }

  function _isHook(address addr) internal view override returns (bool) {
    return _validationHooksLinkedList().exists(addr) || _executionHooksLinkedList().exists(addr);
  }

  function _call(address target, bytes memory data) private returns (bool success) {
    assembly ("memory-safe") {
      success := call(gas(), target, 0, add(data, 0x20), mload(data), 0, 0)
    }
  }

  function _validationHooksLinkedList() private view returns (mapping(address => address) storage validationHooks) {
    validationHooks = SsoStorage.layout().validationHooks;
  }

  function _executionHooksLinkedList() private view returns (mapping(address => address) storage executionHooks) {
    executionHooks = SsoStorage.layout().executionHooks;
  }

  function _supportsHook(address hook, bool isValidation) private view returns (bool) {
    return
      isValidation
        ? hook.supportsInterface(type(IValidationHook).interfaceId)
        : hook.supportsInterface(type(IExecutionHook).interfaceId);
  }
}
