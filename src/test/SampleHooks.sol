// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";

import { IModule } from "../interfaces/IModule.sol";
import { IExecutionHook, IValidationHook } from "../interfaces/IHook.sol";

abstract contract BaseHookValidator is IValidationHook {
  /// @notice Emitted during validation
  event Validating(address indexed accountAddress);

  function onInstall(bytes calldata data) external override {}
  function onUninstall(bytes calldata data) external override {}
  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return
      interfaceId == type(IValidationHook).interfaceId ||
      interfaceId == type(IModule).interfaceId ||
      interfaceId == type(IERC165).interfaceId;
  }
}

abstract contract BaseHookExecution is IExecutionHook {
  /// @notice Emitted during execution
  event Preexecute(address indexed accountAddress);
  event Postexecute(address indexed accountAddress);

  function onInstall(bytes calldata data) external override {}
  function onUninstall(bytes calldata data) external override {}
  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return
      interfaceId == type(IExecutionHook).interfaceId ||
      interfaceId == type(IModule).interfaceId ||
      interfaceId == type(IERC165).interfaceId;
  }
}

/// @title FailHookValidator
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev Sample hook validator that always fails (BURNS THE ACCOUNT)
contract FailHookValidator is BaseHookValidator {
  function validationHook(bytes32, Transaction calldata) external override {
    emit Validating(msg.sender);
    require(false, "SampleHookValidator: validationHook failed");
  }
}

/// @title SuccessHookValidator
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev Sample hook validator that always passes
contract SuccessHookValidator is BaseHookValidator {
  function validationHook(bytes32, Transaction calldata) external override {
    emit Validating(msg.sender);
  }
}

/// @title PreFailHookExecutor
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev Sample hook executor that always fails on pre-execute (BURNS THE ACCOUNT)
contract PreFailHookExecutor is BaseHookExecution {
  function preExecutionHook(Transaction calldata) external override {
    emit Preexecute(msg.sender);
    require(false, "SampleHookExecutor: execution hook failed");
  }

  function postExecutionHook() external override {
    emit Postexecute(msg.sender);
  }
}

/// @title PostFailHookExecutor
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev Sample hook executor that always fails on post-execute (BURNS THE ACCOUNT)
contract PostFailHookExecutor is BaseHookExecution {
  function preExecutionHook(Transaction calldata) external override {
    emit Preexecute(msg.sender);
  }

  function postExecutionHook() external override {
    emit Postexecute(msg.sender);
    require(false, "SampleHookExecutor: executionHook failed");
  }
}

/// @title SuccessHookExecutor
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev Sample hook validator that always passes
contract SuccessHookExecutor is BaseHookExecution {
  function preExecutionHook(Transaction calldata) external override {
    emit Preexecute(msg.sender);
  }

  function postExecutionHook() external override {
    emit Postexecute(msg.sender);
  }
}

/// @title SuccessBothHookExecutor
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev Sample hook execution and validator that always passes
contract SuccessBothHook is IExecutionHook, IValidationHook {
  /// @notice Emitted during execution
  event Preexecute(address indexed accountAddress);
  event Postexecute(address indexed accountAddress);
  /// @notice Emitted during validation
  event Validating(address indexed accountAddress);

  function onInstall(bytes calldata data) external {}
  function onUninstall(bytes calldata data) external {}
  function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
    return
      interfaceId == type(IValidationHook).interfaceId ||
      interfaceId == type(IExecutionHook).interfaceId ||
      interfaceId == type(IModule).interfaceId ||
      interfaceId == type(IERC165).interfaceId;
  }

  function preExecutionHook(Transaction calldata) external override {
    emit Preexecute(msg.sender);
  }

  function postExecutionHook() external override {
    emit Postexecute(msg.sender);
  }

  function validationHook(bytes32, Transaction calldata) external override {
    emit Validating(msg.sender);
  }
}
