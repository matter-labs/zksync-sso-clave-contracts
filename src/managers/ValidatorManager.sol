// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ERC165Checker } from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import { ExcessivelySafeCall } from "@nomad-xyz/excessively-safe-call/src/ExcessivelySafeCall.sol";

import { Auth } from "../auth/Auth.sol";
import { Errors } from "../libraries/Errors.sol";
import { SsoStorage } from "../libraries/SsoStorage.sol";
import { IInitable } from "../interfaces/IInitable.sol";
import { AddressLinkedList } from "../libraries/LinkedList.sol";
import { IValidatorManager } from "../interfaces/IValidatorManager.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";

/**
 * @title Manager contract for validators
 * @notice Abstract contract for managing the validators of the account
 * @dev Validators are stored in a linked list
 * @author https://getclave.io
 */
abstract contract ValidatorManager is IValidatorManager, Auth {
  // Helper library for address to address mappings
  using AddressLinkedList for mapping(address => address);
  // Interface helper library
  using ERC165Checker for address;
  // Low level calls helper library
  using ExcessivelySafeCall for address;

  function addModuleValidator(address validator, bytes calldata accountValidationKey) external onlySelf {
    _addModuleValidator(validator, accountValidationKey);
  }

  ///@inheritdoc IValidatorManager
  function removeModuleValidator(address validator) external onlySelf {
    _removeModuleValidator(validator);
  }

  /// @inheritdoc IValidatorManager
  function isModuleValidator(address validator) external view override returns (bool) {
    return _isModuleValidator(validator);
  }

  /// @inheritdoc IValidatorManager
  function listModuleValidators() external view override returns (address[] memory validatorList) {
    validatorList = _moduleValidatorsLinkedList().list();
  }

  function _addModuleValidator(address validator, bytes memory accountValidationKey) internal {
    if (!_supportsModuleValidator(validator)) {
      revert Errors.VALIDATOR_ERC165_FAIL(validator);
    }

    _moduleValidatorsLinkedList().add(validator);
    IModuleValidator(validator).init(accountValidationKey);

    emit AddModuleValidator(validator);
  }

  function _removeModuleValidator(address validator) private {
    _moduleValidatorsLinkedList().remove(validator);

    validator.excessivelySafeCall(gasleft(), 0, abi.encodeWithSelector(IInitable.disable.selector));

    emit RemoveModuleValidator(validator);
  }

  function _isModuleValidator(address validator) internal view returns (bool) {
    return _moduleValidatorsLinkedList().exists(validator);
  }

  function _supportsModuleValidator(address validator) private view returns (bool) {
    return validator.supportsInterface(type(IModuleValidator).interfaceId);
  }

  function _moduleValidatorsLinkedList() private view returns (mapping(address => address) storage moduleValidators) {
    moduleValidators = SsoStorage.layout().moduleValidators;
  }
}
