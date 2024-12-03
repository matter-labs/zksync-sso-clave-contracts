// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/**
 * @title Manager contract for validators
 * @author https://getclave.io
 */
interface IValidatorManager {
  /**
   * @notice Event emitted when a k1 validator is added
   * @param validator address - Address of the added k1 validator
   */
  event K1AddValidator(address indexed validator);

  /**
   * @notice Event emitted when a modular validator is added
   * @param validator address - Address of the added modular validator
   */
  event AddModuleValidator(address indexed validator);

  /**
   * @notice Event emitted when a k1 validator is removed
   * @param validator address - Address of the removed k1 validator
   */
  event K1RemoveValidator(address indexed validator);

  /**
   * @notice Event emitted when a modular validator is removed
   * @param validator address - Address of the removed modular validator
   */
  event RemoveModuleValidator(address indexed validator);

  /**
   * @notice Adds a validator to the list of modular validators
   * @dev Can only be called by self or a whitelisted module
   * @param validator address - Address of the generic validator to add
   * @param accountValidationKey bytes - data for the validator to use to validate the account
   */
  function addModuleValidator(address validator, bytes memory accountValidationKey) external;

  /**
   * @notice Adds a validator to the list of k1 validators
   * @dev Can only be called by self or a whitelisted module
   * @param validator address - Address of the k1 validator to add
   */
  function k1AddValidator(address validator) external;

  /**
   * @notice Removes a validator from the list of k1 validators
   * @dev Can only be called by self or a whitelisted module
   * @param validator address - Address of the validator to remove
   */
  function k1RemoveValidator(address validator) external;

  /**
   * @notice Removes a validator from the list of modular validators
   * @dev Can only be called by self or a whitelisted module
   * @param validator address - Address of the validator to remove
   */
  function removeModuleValidator(address validator) external;

  /**
   * @notice Checks if an address is in the k1 validator list
   * @param validator address - Address of the validator to check
   * @return True if the address is a validator, false otherwise
   */
  function k1IsValidator(address validator) external view returns (bool);

  /**
   * @notice Checks if an address is in the modular validator list
   * @param validator address - Address of the validator to check
   * @return True if the address is a validator, false otherwise
   */
  function isModuleValidator(address validator) external view returns (bool);

  /**
   * @notice Returns the list of k1 validators
   * @return validatorList address[] memory - Array of k1 validator addresses
   */
  function k1ListValidators() external view returns (address[] memory validatorList);

  /**
   * @notice Returns the list of modular validators
   * @return validatorList address[] memory - Array of modular validator addresses
   */
  function listModuleValidators() external view returns (address[] memory validatorList);
}
