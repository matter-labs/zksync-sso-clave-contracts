// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ERC165Checker } from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import { Auth } from "../auth/Auth.sol";
import { Errors } from "../libraries/Errors.sol";
import { SsoStorage } from "../libraries/SsoStorage.sol";
import { IValidatorManager } from "../interfaces/IValidatorManager.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import { IModule } from "../interfaces/IModule.sol";

/**
 * @title Manager contract for validators
 * @notice Abstract contract for managing the validators of the account
 * @dev Validators are stored in a linked list
 * @author https://getclave.io
 */
abstract contract ValidatorManager is IValidatorManager, Auth {
  using EnumerableSet for EnumerableSet.AddressSet;
  // Interface helper library
  using ERC165Checker for address;

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
    validatorList = _moduleValidators().values();
  }

  function _addModuleValidator(address validator, bytes memory accountValidationKey) internal {
    if (!_supportsModuleValidator(validator)) {
      revert Errors.VALIDATOR_ERC165_FAIL(validator);
    }

    _moduleValidators().add(validator);
    if (accountValidationKey.length > 0) {
      IModule(validator).onInstall(accountValidationKey);
    }

    emit AddModuleValidator(validator);
  }

  function _removeModuleValidator(address validator) internal {
    _moduleValidators().remove(validator);

    emit RemoveModuleValidator(validator);
  }

  function _isModuleValidator(address validator) internal view returns (bool) {
    return _moduleValidators().contains(validator);
  }

  function _supportsModuleValidator(address validator) private view returns (bool) {
    return
      validator.supportsInterface(type(IModuleValidator).interfaceId) &&
      validator.supportsInterface(type(IModule).interfaceId);
  }

  function _moduleValidators() private view returns (EnumerableSet.AddressSet storage moduleValidators) {
    moduleValidators = SsoStorage.layout().moduleValidators;
  }
}
