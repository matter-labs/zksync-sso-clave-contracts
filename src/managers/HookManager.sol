// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ERC165Checker } from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { ExcessivelySafeCall } from "@nomad-xyz/excessively-safe-call/src/ExcessivelySafeCall.sol";

import { Auth } from "../auth/Auth.sol";
import { SsoStorage } from "../libraries/SsoStorage.sol";
import { AddressLinkedList } from "../libraries/LinkedList.sol";
import { Errors } from "../libraries/Errors.sol";
import { IExecutionHook } from "../interfaces/IHook.sol";
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

  function _setHook(address hook) internal virtual {
    bytes32 slot = CONTEXT_KEY;
    assembly {
      sstore(slot, hook)
    }
  }

  function _installHook(address hook, bytes calldata data) internal virtual {
    address currentHook = _getHook();
    if (currentHook != address(0)) {
      revert HookAlreadyInstalled(currentHook);
    }
    // add to 4337 flow
    _setHook(hook);

    // add to ZKsync flow
    _executionHooksLinkedList().add(hook);
  }

  function _uninstallHook(address hook, bytes calldata data) internal virtual {
    _setHook(address(0));
  }

  function _getHook() internal view returns (address _hook) {
    bytes32 slot = CONTEXT_KEY;
    assembly {
      _hook := sload(slot)
    }
  }

  function _isHookInstalled(address module) internal view returns (bool) {
    return _getHook() == module;
  }

  function getActiveHook() external view returns (address hook) {
    return _getHook();
  }

  /// @inheritdoc IHookManager
  function addHook(bytes calldata hookAndData) external override onlySelf {
    _addHook(hookAndData);
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
    if (!isValidation) {
      hookList = _executionHooksLinkedList().list();
    }
  }

  // Runs the execution hooks that are enabled by the account before and after _executeTransaction
  modifier runExecutionHooks(Transaction calldata transaction) {
    mapping(address => address) storage executionHooks = _executionHooksLinkedList();

    address cursor = executionHooks[AddressLinkedList.SENTINEL_ADDRESS];
    // Iterate through hooks
    while (cursor > AddressLinkedList.SENTINEL_ADDRESS) {
      // Call the preExecutionHook function with transaction struct
      bytes memory context = IExecutionHook(cursor).preExecutionHook(transaction);
      // Store returned data as context
      _setContext(cursor, context);

      cursor = executionHooks[cursor];
    }

    _;

    cursor = executionHooks[AddressLinkedList.SENTINEL_ADDRESS];
    // Iterate through hooks
    while (cursor > AddressLinkedList.SENTINEL_ADDRESS) {
      bytes memory context = _getContext(cursor);
      if (context.length > 0) {
        // Call the postExecutionHook function with stored context
        IExecutionHook(cursor).postExecutionHook(context);
        // Delete context
        _deleteContext(cursor);
      }

      cursor = executionHooks[cursor];
    }
  }

  function _setContext(address hook, bytes memory context) private {
    _hookDataStore()[hook][CONTEXT_KEY] = context;
  }

  function _deleteContext(address hook) private {
    delete _hookDataStore()[hook][CONTEXT_KEY];
  }

  function _getContext(address hook) private view returns (bytes memory context) {
    context = _hookDataStore()[hook][CONTEXT_KEY];
  }

  function _hookDataStore() private view returns (mapping(address => mapping(bytes32 => bytes)) storage hookDataStore) {
    hookDataStore = SsoStorage.layout().hookDataStore;
  }

  function _addHook(bytes calldata hookAndData) internal {
    if (hookAndData.length < 20) {
      revert Errors.EMPTY_HOOK_ADDRESS();
    }

    address hookAddress = address(bytes20(hookAndData[0:20]));
    if (!_supportsHook(hookAddress)) {
      revert Errors.HOOK_ERC165_FAIL();
    }

    _executionHooksLinkedList().add(hookAddress);

    emit AddHook(hookAddress);
  }

  function _removeHook(address hook, bool isValidation) internal {
    if (!isValidation) {
      _executionHooksLinkedList().remove(hook);
    }

    hook.excessivelySafeCall(gasleft(), 0, abi.encodeWithSelector(IInitable.disable.selector));

    emit RemoveHook(hook);
  }

  function _isHook(address addr) internal view override returns (bool) {
    return _executionHooksLinkedList().exists(addr);
  }

  function _call(address target, bytes memory data) private returns (bool success) {
    assembly ("memory-safe") {
      success := call(gas(), target, 0, add(data, 0x20), mload(data), 0, 0)
    }
  }

  function _executionHooksLinkedList() private view returns (mapping(address => address) storage executionHooks) {
    executionHooks = SsoStorage.layout().executionHooks;
  }

  function _supportsHook(address hook) internal view returns (bool) {
    return hook.supportsInterface(type(IExecutionHook).interfaceId);
  }
}
