// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IModuleValidator } from "./IModuleValidator.sol";
import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";

/// @title IGuardianRecoveryValidator
/// @notice Interface for managing guardian-based account recovery functionality
/// @dev Extends IModuleValidator to provide recovery validation capabilities
interface IGuardianRecoveryValidator is IModuleValidator {
  /// @notice Represents a guardian's information
  /// @param addr The address of the guardian
  /// @param isReady Whether the guardian has accepted being added as a guardian
  /// @param addedAt Timestamp when the guardian was added
  struct Guardian {
    address addr;
    bool isReady;
    uint64 addedAt;
  }

  /// @notice Represents a recovery request's data
  /// @param hashedCredentialId Hash of the credential ID used for recovery
  /// @param rawPublicKey The public key associated with the recovery
  /// @param timestamp When the recovery request was initiated
  struct RecoveryRequest {
    bytes32 hashedCredentialId;
    bytes32[2] rawPublicKey;
    uint256 timestamp;
  }

  /// @notice Error thrown when attempting to set self as guardian
  error GuardianCannotBeSelf();

  /// @notice Error thrown when a guardian address is not found
  /// @param guardian The address of the guardian that was not found
  error GuardianNotFound(address guardian);

  /// @notice Error thrown when attempting to add a guardian that wasn't proposed
  /// @param guardian The address of the guardian that wasn't proposed
  error GuardianNotProposed(address guardian);

  /// @notice Error thrown when an account is already guarded by the specified guardian
  /// @param account The account address
  /// @param guardian The guardian address
  error AccountAlreadyGuardedByGuardian(address account, address guardian);

  /// @notice Error thrown when an account is not guarded by the specified address
  /// @param account The account address
  /// @param guardian The guardian address
  error AccountNotGuardedByAddress(address account, address guardian);

  /// @notice Error thrown when an account recovery is already in progress
  error AccountRecoveryInProgress();

  /// @notice Error thrown when the WebAuthValidator is not enabled for the account
  error WebAuthValidatorNotEnabled();

  /// @notice Error thrown when an invalid guardian address is provided
  error InvalidGuardianAddress();

  /// @notice Error thrown when an invalid web auth validator address is provided
  error InvalidWebAuthValidatorAddress();

  /// @notice Error thrown when an invalid account to guard address is provided
  error InvalidAccountToGuardAddress();

  /// @notice Error thrown when an invalid account to recover address is provided
  error InvalidAccountToRecoverAddress();

  /// @notice Error thrown when a non-function call transaction is detected
  error NonFunctionCallTransaction();

  /// @notice Error thrown when an unknown hashed origin domain is provided
  /// @param hashedOriginDomain Hash of the unknown origin domain
  error UnknownHashedOriginDomain(bytes32 hashedOriginDomain);

  /// @notice Emitted when an origin domain is enabled for an account
  /// @param account The account that the origin domain is enabled for
  /// @param hashedOriginDomain Hash of the origin domain that is enabled
  event HashedOriginDomainEnabledForAccount(address indexed account, bytes32 indexed hashedOriginDomain);

  /// @notice Emitted when an origin domain is disabled for an account
  /// @param account The account that the origin domain is disabled for
  /// @param hashedOriginDomain Hash of the origin domain that is disabled
  event HashedOriginDomainDisabledForAccount(address indexed account, bytes32 indexed hashedOriginDomain);

  /// @notice Emitted when a recovery process is initiated
  /// @param account The account being recovered
  /// @param hashedOriginDomain Hash of the origin domain
  /// @param hashedCredentialId Hash of the credential ID
  /// @param guardian The guardian initiating the recovery
  event RecoveryInitiated(
    address indexed account,
    bytes32 indexed hashedOriginDomain,
    bytes32 indexed hashedCredentialId,
    address guardian
  );

  /// @notice Emitted when a recovery process is successfully completed
  /// @param account The account that was recovered
  /// @param hashedOriginDomain Hash of the origin domain
  /// @param hashedCredentialId Hash of the credential ID
  event RecoveryFinished(
    address indexed account,
    bytes32 indexed hashedOriginDomain,
    bytes32 indexed hashedCredentialId
  );

  /// @notice Emitted when a recovery process is discarded
  /// @param account The account for which recovery was discarded
  /// @param hashedOriginDomain Hash of the origin domain
  /// @param hashedCredentialId Hash of the credential ID
  event RecoveryDiscarded(
    address indexed account,
    bytes32 indexed hashedOriginDomain,
    bytes32 indexed hashedCredentialId
  );

  /// @notice Emitted when a new guardian is proposed
  /// @param account The account proposing the guardian
  /// @param hashedOriginDomain Hash of the origin domain
  /// @param guardian The proposed guardian address
  event GuardianProposed(address indexed account, bytes32 indexed hashedOriginDomain, address indexed guardian);

  /// @notice Emitted when a guardian is successfully added
  /// @param account The account adding the guardian
  /// @param hashedOriginDomain Hash of the origin domain
  /// @param guardian The added guardian address
  event GuardianAdded(address indexed account, bytes32 indexed hashedOriginDomain, address indexed guardian);

  /// @notice Emitted when a guardian is removed
  /// @param account The account removing the guardian
  /// @param hashedOriginDomain Hash of the origin domain
  /// @param guardian The removed guardian address
  event GuardianRemoved(address indexed account, bytes32 indexed hashedOriginDomain, address indexed guardian);

  /// @notice Proposes a new guardian for an account
  /// @dev Takes an external account address, stores it as a pending guardian for the account
  /// and enables `addGuardian` to be called by the proposed guardian
  /// @param hashedOriginDomain Hash of the origin domain
  /// @param newGuardian Address of the proposed guardian
  function proposeGuardian(bytes32 hashedOriginDomain, address newGuardian) external;

  /// @notice Removes a guardian from an account
  /// @param hashedOriginDomain Hash of the origin domain
  /// @param guardianToRemove Address of the guardian to remove
  function removeGuardian(bytes32 hashedOriginDomain, address guardianToRemove) external;

  /// @notice Accepts being added as a guardian to an account
  /// @param hashedOriginDomain Hash of the origin domain
  /// @param accountToGuard Address of the account to be guarded
  /// @return bool Whether the guardian was successfully added
  function addGuardian(bytes32 hashedOriginDomain, address accountToGuard) external returns (bool);

  /// @notice Initiates a recovery process for an account
  /// @param accountToRecover Address of the account to recover
  /// @param hashedCredentialId Hash of the credential ID
  /// @param rawPublicKey Public key for the recovery
  /// @param hashedOriginDomain Hash of the origin domain
  function initRecovery(
    address accountToRecover,
    bytes32 hashedCredentialId,
    bytes32[2] memory rawPublicKey,
    bytes32 hashedOriginDomain
  ) external;

  /// @notice Discards an ongoing recovery process
  /// @param hashedOriginDomain Hash of the origin domain
  function discardRecovery(bytes32 hashedOriginDomain) external;

  /// @notice Retrieves all guardians for a specific address and origin domain
  /// @param hashedOriginDomain Hash of the origin domain
  /// @param addr Address to get guardians for
  /// @return Array of Guardian structs
  function guardiansFor(bytes32 hashedOriginDomain, address addr) external view returns (Guardian[] memory);

  /// @notice Retrieves all accounts guarded by a specific guardian and origin domain
  /// @param hashedOriginDomain Hash of the origin domain
  /// @param guardian Address of the guardian
  /// @return Array of account addresses
  function guardianOf(bytes32 hashedOriginDomain, address guardian) external view returns (address[] memory);

  /// @notice Retrieves pending recovery data for an account and origin domain pair
  /// @param hashedOriginDomain Hash of the origin domain
  /// @param account Address of the account
  /// @return RecoveryRequest struct containing recovery data
  function getPendingRecoveryData(
    bytes32 hashedOriginDomain,
    address account
  ) external view returns (RecoveryRequest memory);
}
