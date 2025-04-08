// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IModuleValidator } from "./IModuleValidator.sol";
import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";

interface IGuardianRecoveryValidator is IModuleValidator {
  struct Guardian {
    address addr;
    bool isReady;
    uint64 addedAt;
  }

  struct RecoveryRequest {
    bytes32 hashedCredentialId;
    bytes32[2] rawPublicKey;
    uint256 timestamp;
  }

  error GuardianCannotBeSelf();
  error GuardianNotFound(address guardian);
  error GuardianNotProposed(address guardian);
  error AccountAlreadyGuardedByGuardian(address account, address guardian);
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

  event RecoveryInitiated(
    address indexed account,
    bytes32 indexed hashedOriginDomain,
    bytes32 indexed hashedCredentialId,
    address guardian
  );
  event RecoveryFinished(
    address indexed account,
    bytes32 indexed hashedOriginDomain,
    bytes32 indexed hashedCredentialId
  );
  event RecoveryDiscarded(
    address indexed account,
    bytes32 indexed hashedOriginDomain,
    bytes32 indexed hashedCredentialId
  );
  event GuardianProposed(address indexed account, bytes32 indexed hashedOriginDomain, address indexed guardian);
  event GuardianAdded(address indexed account, bytes32 indexed hashedOriginDomain, address indexed guardian);
  event GuardianRemoved(address indexed account, bytes32 indexed hashedOriginDomain, address indexed guardian);

  /// @notice Emitted when an origin domain is enabled for an account
  /// @param account The account that the origin domain is enabled for
  /// @param hashedOriginDomain Hash of the origin domain that is enabled
  event HashedOriginDomainEnabledForAccount(address indexed account, bytes32 indexed hashedOriginDomain);

  /// @notice Emitted when an origin domain is disabled for an account
  /// @param account The account that the origin domain is disabled for
  /// @param hashedOriginDomain Hash of the origin domain that is disabled
  event HashedOriginDomainDisabledForAccount(address indexed account, bytes32 indexed hashedOriginDomain);

  function proposeGuardian(bytes32 hashedOriginDomain, address newGuardian) external;

  function removeGuardian(bytes32 hashedOriginDomain, address guardianToRemove) external;

  function addGuardian(bytes32 hashedOriginDomain, address accountToGuard) external returns (bool);

  function initRecovery(
    address accountToRecover,
    bytes32 hashedCredentialId,
    bytes32[2] memory rawPublicKey,
    bytes32 hashedOriginDomain
  ) external;

  function discardRecovery(bytes32 hashedOriginDomain) external;

  function guardiansFor(bytes32 hashedOriginDomain, address addr) external view returns (Guardian[] memory);

  function guardianOf(bytes32 hashedOriginDomain, address guardian) external view returns (address[] memory);

  function getPendingRecoveryData(
    bytes32 hashedOriginDomain,
    address account
  ) external view returns (RecoveryRequest memory);
}
