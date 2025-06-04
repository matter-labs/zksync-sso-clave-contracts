// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IModuleValidator } from "./IModuleValidator.sol";

/// @title IWebAuthValidator
interface IWebAuthValidator is IModuleValidator {
  /// @notice Represents a passkey identifier, which includes the domain and credential ID
  struct PasskeyId {
    string domain;
    bytes credentialId;
  }

  /// @notice Emitted when a passkey is created
  /// @param keyOwner The address of the account that owns the passkey
  /// @param originDomain The domain for which the passkey was created, typically an Auth Server
  /// @param credentialId The unique identifier for the passkey
  event PasskeyCreated(address indexed keyOwner, string originDomain, bytes credentialId);
  /// @notice Emitted when a passkey is removed from the account
  /// @param keyOwner The address of the account that owned the passkey
  /// @param originDomain The domain for which the that passkey was used
  /// @param credentialId The unique identifier for the passkey that was removed
  event PasskeyRemoved(address indexed keyOwner, string originDomain, bytes credentialId);

  function getAccountKey(
    string calldata originDomain,
    bytes calldata credentialId,
    address accountAddress
  ) external view returns (bytes32[2] memory);

  function addValidationKey(
    bytes memory credentialId,
    bytes32[2] memory rawPublicKey,
    string memory originDomain
  ) external;

  function removeValidationKey(bytes memory credentialId, string memory domain) external;
}
