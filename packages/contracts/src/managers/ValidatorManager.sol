// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ERC165Checker } from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import { Auth } from "../auth/Auth.sol";
import { Errors } from "../libraries/Errors.sol";
import { SsoStorage } from "../libraries/SsoStorage.sol";
import { AddressLinkedList } from "../libraries/LinkedList.sol";
import { IR1Validator, IK1Validator } from "../interfaces/IValidator.sol";
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

  /// @inheritdoc IValidatorManager
  function r1AddValidator(address validator) external override onlySelfOrModule {
    _r1AddValidator(validator);
  }

  function addModuleValidator(address validator, bytes memory initialAccountValidationKey) external onlySelfOrModule {
    _addModuleValidator(validator, initialAccountValidationKey);
  }

  /// @inheritdoc IValidatorManager
  function k1AddValidator(address validator) external override onlySelfOrModule {
    _k1AddValidator(validator);
  }

  /// @inheritdoc IValidatorManager
  function r1RemoveValidator(address validator) external override onlySelfOrModule {
    _r1RemoveValidator(validator);
  }

  /// @inheritdoc IValidatorManager
  function k1RemoveValidator(address validator) external override onlySelfOrModule {
    _k1RemoveValidator(validator);
  }

  ///@inheritdoc IValidatorManager
  function removeModuleValidator(address validator) external onlySelfOrModule {
    _removeModuleValidator(validator);
  }

  /// @inheritdoc IValidatorManager
  function r1IsValidator(address validator) external view override returns (bool) {
    return _r1IsValidator(validator);
  }

  /// @inheritdoc IValidatorManager
  function k1IsValidator(address validator) external view override returns (bool) {
    return _k1IsValidator(validator);
  }

  /// @inheritdoc IValidatorManager
  function isModuleValidator(address validator) external view override returns (bool) {
    return _isModuleValidator(validator);
  }

  /// @inheritdoc IValidatorManager
  function r1ListValidators() external view override returns (address[] memory validatorList) {
    validatorList = _r1ValidatorsLinkedList().list();
  }

  /// @inheritdoc IValidatorManager
  function k1ListValidators() external view override returns (address[] memory validatorList) {
    validatorList = _k1ValidatorsLinkedList().list();
  }

  /// @inheritdoc IValidatorManager
  function listModuleValidators() external view override returns (address[] memory validatorList) {
    validatorList = _moduleValidatorsLinkedList().list();
  }

  function _r1AddValidator(address validator) internal {
    if (!_supportsR1(validator)) {
      revert Errors.VALIDATOR_ERC165_FAIL();
    }

    _r1ValidatorsLinkedList().add(validator);

    emit R1AddValidator(validator);
  }

  function _addModuleValidator(address validator, bytes memory accountValidationKey) internal {
    if (!_supportsModuleValidator(validator)) {
      revert Errors.VALIDATOR_ERC165_FAIL();
    }

    _moduleValidatorsLinkedList().add(validator);
    IModuleValidator(validator).addValidationKey(accountValidationKey);

    emit AddModuleValidator(validator);
  }

  function _k1AddValidator(address validator) internal {
    if (!_supportsK1(validator)) {
      revert Errors.VALIDATOR_ERC165_FAIL();
    }

    _k1ValidatorsLinkedList().add(validator);

    emit K1AddValidator(validator);
  }

  function _r1RemoveValidator(address validator) internal {
    _r1ValidatorsLinkedList().remove(validator);

    if (_r1ValidatorsLinkedList().isEmpty()) {
      revert Errors.EMPTY_R1_VALIDATORS();
    }

    emit R1RemoveValidator(validator);
  }

  function _k1RemoveValidator(address validator) internal {
    _k1ValidatorsLinkedList().remove(validator);

    emit K1RemoveValidator(validator);
  }

  function _removeModuleValidator(address validator) internal {
    _moduleValidatorsLinkedList().remove(validator);

    emit RemoveModuleValidator(validator);
  }

  function _r1IsValidator(address validator) internal view returns (bool) {
    return _r1ValidatorsLinkedList().exists(validator);
  }

  function _isModuleValidator(address validator) internal view returns (bool) {
    return _moduleValidatorsLinkedList().exists(validator);
  }

  function _k1IsValidator(address validator) internal view returns (bool) {
    return _k1ValidatorsLinkedList().exists(validator);
  }

  function _supportsR1(address validator) internal view returns (bool) {
    return validator.supportsInterface(type(IR1Validator).interfaceId);
  }

  function _supportsK1(address validator) internal view returns (bool) {
    return validator.supportsInterface(type(IK1Validator).interfaceId);
  }

  function _supportsModuleValidator(address validator) internal view returns (bool) {
    return validator.supportsInterface(type(IModuleValidator).interfaceId);
  }

  function _r1ValidatorsLinkedList() private view returns (mapping(address => address) storage r1Validators) {
    r1Validators = SsoStorage.layout().r1Validators;
  }

  function _moduleValidatorsLinkedList() private view returns (mapping(address => address) storage moduleValidators) {
    moduleValidators = SsoStorage.layout().moduleValidators;
  }

  function _k1ValidatorsLinkedList() private view returns (mapping(address => address) storage k1Validators) {
    k1Validators = SsoStorage.layout().k1Validators;
  }
}
