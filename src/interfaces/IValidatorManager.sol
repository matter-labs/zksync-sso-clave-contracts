// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/**
 * @title Manager contract for validators
 * @author https://getclave.io
 */
interface IValidatorManager {
  /**
   * @notice Event emitted when a modular validator is added
   * @param validator address - Address of the added modular validator
   */
  event AddModuleValidator(address indexed validator);

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
   * @notice Removes a validator from the list of modular validators
   * @dev Can only be called by self or a whitelisted module
   * @param validator address - Address of the validator to remove
   */
  function removeModuleValidator(address validator) external;

  /**
   * @notice Checks if an address is in the modular validator list
   * @param validator address - Address of the validator to check
   * @return True if the address is a validator, false otherwise
   */
  function isModuleValidator(address validator) external view returns (bool);

  /**
   * @notice Returns the list of modular validators
   * @return validatorList address[] memory - Array of modular validator addresses
   */
  function listModuleValidators() external view returns (address[] memory validatorList);
}
