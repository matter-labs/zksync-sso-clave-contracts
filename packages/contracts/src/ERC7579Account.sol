// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./libraries/ERC7579Mode.sol";

import "./interfaces/IERC7579Module.sol";
import "./interfaces/IERC7579Validator.sol";

import { BOOTLOADER_FORMAL_ADDRESS } from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import { IAccount } from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IAccount.sol";
import { EfficientCall } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/EfficientCall.sol";

import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

import { Call } from "./batch/BatchCaller.sol";

import { IERC7579Account } from "./interfaces/IERC7579Account.sol";
import { ModuleManager } from "./managers/ModuleManager.sol";
import { HookManager } from "./managers/HookManager.sol";
import { ExecutionHelper } from "./helpers/Execution.sol";

import { ClaveAccount } from "./ClaveAccount.sol";
import { PackedUserOperation } from "./interfaces/PackedUserOperation.sol";

/**
 * @author zeroknots.eth | rhinestone.wtf
 * Reference implementation of a very simple ERC7579 Account.
 * This account implements CallType: SINGLE, BATCH and DELEGATECALL.
 * This account implements ExecType: DEFAULT and TRY.
 * Hook support is implemented
 */
contract ERC7579Account is IERC7579Account, HookManager, ModuleManager, ExecutionHelper, ClaveAccount {
  using ModeLib for ModeCode;
  error AccountAccessUnauthorized();
  // Error thrown when an unsupported ModuleType is requested
  error UnsupportedModuleType(uint256 moduleTypeId);
  // Error thrown when an execution with an unsupported CallType was made
  error UnsupportedCallType(CallType callType);
  // Error thrown when an execution with an unsupported ExecType was made
  error UnsupportedExecType(ExecType execType);
  // Error thrown when account initialization fails
  error AccountInitializationFailed();
  // Error thrown when account installs/unistalls module with mismatched input `moduleTypeId`
  error MismatchModuleTypeId(uint256 moduleTypeId);

  bytes4 constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;
  address private _factory = address(0);

  /////////////////////////////////////////////////////
  // Access Control
  ////////////////////////////////////////////////////

  modifier onlyEntryPointOrSelf() virtual {
    if (!(msg.sender == BOOTLOADER_FORMAL_ADDRESS || msg.sender == address(this) || msg.sender == _factory)) {
      revert AccountAccessUnauthorized();
    }
    _;
  }

  modifier onlyEntryPoint() virtual {
    if (msg.sender != BOOTLOADER_FORMAL_ADDRESS) {
      revert AccountAccessUnauthorized();
    }
    _;
  }

  /**
   * @inheritdoc IERC7579Account
   * @dev this function is only callable by the entry point or the account itself
   * @dev this function demonstrates how to implement
   * CallType SINGLE and BATCH and ExecType DEFAULT and TRY
   * @dev this function demonstrates how to implement hook support (modifier)
   */
  function execute(ModeCode mode, bytes calldata executionCalldata) external payable onlyEntryPointOrSelf withHook {
    (CallType callType, ExecType execType, , ) = mode.decode();

    // check if calltype is batch or single
    if (keccak256(abi.encodePacked(callType)) == keccak256(abi.encodePacked(CALLTYPE_BATCH))) {
      // destructure executionCallData according to batched exec
      Execution[] calldata executions = decodeBatch(executionCalldata);
      // check if execType is revert or try
      if (ExecType.unwrap(execType) == ExecType.unwrap(EXECTYPE_DEFAULT)) _execute(executions);
      else if (ExecType.unwrap(execType) == ExecType.unwrap(EXECTYPE_TRY)) _tryExecute(executions);
      else revert UnsupportedExecType(execType);
    } else if (CallType.unwrap(callType) == CallType.unwrap(CALLTYPE_SINGLE)) {
      // destructure executionCallData according to single exec
      (address target, uint256 value, bytes calldata callData) = decodeSingle(executionCalldata);
      // check if execType is revert or try
      if (ExecType.unwrap(execType) == ExecType.unwrap(EXECTYPE_DEFAULT))
        _execute(target, value, callData);
        // TODO: implement event emission for tryExecute singleCall
      else if (ExecType.unwrap(execType) == ExecType.unwrap(EXECTYPE_TRY)) _tryExecute(target, value, callData);
      else revert UnsupportedExecType(execType);
    } else if (CallType.unwrap(callType) == CallType.unwrap(CALLTYPE_DELEGATECALL)) {
      // destructure executionCallData according to single exec
      address delegate = address(uint160(bytes20(executionCalldata[0:20])));
      bytes calldata callData = executionCalldata[20:];
      // check if execType is revert or try
      if (ExecType.unwrap(execType) == ExecType.unwrap(EXECTYPE_DEFAULT)) _executeDelegatecall(delegate, callData);
      else if (ExecType.unwrap(execType) == ExecType.unwrap(EXECTYPE_TRY)) _tryExecuteDelegatecall(delegate, callData);
      else revert UnsupportedExecType(execType);
    } else {
      revert UnsupportedCallType(callType);
    }
  }

  /**
   * @inheritdoc IERC7579Account
   * @dev this function is only callable by an installed executor module
   * @dev this function demonstrates how to implement
   * CallType SINGLE and BATCH and ExecType DEFAULT and TRY
   * @dev this function demonstrates how to implement hook support (modifier)
   */
  function executeFromExecutor(
    ModeCode mode,
    bytes calldata executionCalldata
  )
    external
    payable
    withHook
    returns (
      bytes[] memory returnData // TODO returnData is not used
    )
  {
    (CallType callType, ExecType execType, , ) = mode.decode();

    // check if calltype is batch or single
    if (CallType.unwrap(callType) == CallType.unwrap(CALLTYPE_BATCH)) {
      // destructure executionCallData according to batched exec
      Execution[] calldata executions = decodeBatch(executionCalldata);
      // check if execType is revert or try
      if (ExecType.unwrap(execType) == ExecType.unwrap(EXECTYPE_DEFAULT)) returnData = _execute(executions);
      else if (ExecType.unwrap(execType) == ExecType.unwrap(EXECTYPE_TRY)) returnData = _tryExecute(executions);
      else revert UnsupportedExecType(execType);
    } else if (CallType.unwrap(callType) == CallType.unwrap(CALLTYPE_SINGLE)) {
      // destructure executionCallData according to single exec
      (address target, uint256 value, bytes calldata callData) = decodeSingle(executionCalldata);
      returnData = new bytes[](1);
      bool success;
      // check if execType is revert or try
      if (ExecType.unwrap(execType) == ExecType.unwrap(EXECTYPE_DEFAULT)) {
        returnData[0] = _execute(target, value, callData);
      }
      // TODO: implement event emission for tryExecute singleCall
      else if (ExecType.unwrap(execType) == ExecType.unwrap(EXECTYPE_TRY)) {
        (success, returnData[0]) = _tryExecute(target, value, callData);
        if (!success) emit TryExecuteUnsuccessful(0, returnData[0]);
      } else {
        revert UnsupportedExecType(execType);
      }
    } else if (CallType.unwrap(callType) == CallType.unwrap(CALLTYPE_DELEGATECALL)) {
      // destructure executionCallData according to single exec
      address delegate = address(uint160(bytes20(executionCalldata[0:20])));
      bytes calldata callData = executionCalldata[20:];
      // check if execType is revert or try
      if (ExecType.unwrap(execType) == ExecType.unwrap(EXECTYPE_DEFAULT)) _executeDelegatecall(delegate, callData);
      else if (ExecType.unwrap(execType) == ExecType.unwrap(EXECTYPE_TRY)) _tryExecuteDelegatecall(delegate, callData);
      else revert UnsupportedExecType(execType);
    } else {
      revert UnsupportedCallType(callType);
    }
  }

  /**
   * @inheritdoc IERC7579Account
   */
  function installModule(
    uint256 moduleTypeId,
    address module,
    bytes calldata initData
  ) external payable onlyEntryPointOrSelf withHook {
    if (!IERC7579Module(module).isModuleType(moduleTypeId)) revert MismatchModuleTypeId(moduleTypeId);

    if (moduleTypeId == MODULE_TYPE_VALIDATOR) _addUserOpValidator(module, initData);
    else if (moduleTypeId == MODULE_TYPE_EXECUTOR) _addExternalExecutorPermission(module, initData);
    else if (moduleTypeId == MODULE_TYPE_FALLBACK) _addFallbackModule(module, initData);
    else if (moduleTypeId == MODULE_TYPE_HOOK) _installHook(module, initData);
    else revert UnsupportedModuleType(moduleTypeId);
    emit ModuleInstalled(moduleTypeId, module);
  }

  /**
   * @inheritdoc IERC7579Account
   */
  function uninstallModule(
    uint256 moduleTypeId,
    address module,
    bytes calldata deInitData
  ) external payable onlyEntryPointOrSelf withHook {
    if (moduleTypeId == MODULE_TYPE_VALIDATOR) {
      _uninstallValidator(module, deInitData);
    } else if (moduleTypeId == MODULE_TYPE_EXECUTOR) {
      _removeExternalExecutorModule(module, deInitData);
    } else if (moduleTypeId == MODULE_TYPE_FALLBACK) {
      _removeFallbackModule(module, deInitData);
    } else if (moduleTypeId == MODULE_TYPE_HOOK) {
      _uninstallHook(module, deInitData);
    } else {
      revert UnsupportedModuleType(moduleTypeId);
    }
    emit ModuleUninstalled(moduleTypeId, module);
  }

  /**
   * @dev ERC-4337 validateUserOp according to ERC-4337 v0.7
   *         This function is intended to be called by ERC-4337 EntryPoint.sol
   * this validation function should decode / sload the validator module to validate the userOp
   * and call it.
   *
   * @dev MSA MUST implement this function signature.
   * @param userOp PackedUserOperation struct (see ERC-4337 v0.7+)
   */
  function validateUserOp(
    PackedUserOperation calldata userOp,
    bytes32 userOpHash,
    uint256 missingAccountFunds
  ) external payable virtual onlyEntryPoint returns (uint256 validSignature) {
    address validator;
    // @notice validator encoding in nonce is just an example!
    // @notice this is not part of the standard!
    // Account Vendors may choose any other way to implement validator selection
    uint256 nonce = userOp.nonce;
    assembly {
      validator := shr(96, nonce)
    }

    // bubble up the return value of the validator module
    validSignature = IUserOpValidator(validator).validateUserOp(userOp, userOpHash);
  }

  /**
   * @inheritdoc IERC7579Account
   */
  function isModuleInstalled(
    uint256 moduleTypeId,
    address module,
    bytes calldata additionalContext
  ) external view override returns (bool) {
    if (moduleTypeId == MODULE_TYPE_VALIDATOR) {
      return _isModule(module);
    } else if (moduleTypeId == MODULE_TYPE_EXECUTOR) {
      return _isModule(module);
    } else if (moduleTypeId == MODULE_TYPE_FALLBACK) {
      return _isModule(module);
    } else if (moduleTypeId == MODULE_TYPE_HOOK) {
      return _isHook(module);
    } else {
      return false;
    }
  }

  /**
   * @inheritdoc IERC7579Account
   */
  function supportsExecutionMode(ModeCode mode) external view virtual override returns (bool isSupported) {
    (CallType callType, ExecType execType, , ) = mode.decode();
    if (CallType.unwrap(callType) == CallType.unwrap(CALLTYPE_BATCH)) isSupported = true;
    else if (CallType.unwrap(callType) == CallType.unwrap(CALLTYPE_SINGLE)) isSupported = true;
    else if (CallType.unwrap(callType) == CallType.unwrap(CALLTYPE_DELEGATECALL))
      isSupported = true;
      // if callType is not single, batch or delegatecall return false
    else return false;

    if (ExecType.unwrap(execType) == ExecType.unwrap(EXECTYPE_DEFAULT)) isSupported = true;
    else if (ExecType.unwrap(execType) == ExecType.unwrap(EXECTYPE_TRY))
      isSupported = true;
      // if execType is not default or try, return false
    else return false;
  }

  /**
   * @inheritdoc IERC7579Account
   */
  function supportsModule(uint256 moduleTypeId) external view virtual override returns (bool) {
    if (moduleTypeId == MODULE_TYPE_VALIDATOR) return true;
    else if (moduleTypeId == MODULE_TYPE_EXECUTOR) return true;
    else if (moduleTypeId == MODULE_TYPE_FALLBACK) return true;
    else if (moduleTypeId == MODULE_TYPE_HOOK) return true;
    else return false;
  }

  /**
   * @inheritdoc IERC7579Account
   */
  function accountId() external view virtual override returns (string memory) {
    // vendor.flavour.SemVer
    return "zksync.default.v0.1";
  }
}
