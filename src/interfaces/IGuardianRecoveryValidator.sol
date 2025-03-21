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
  error PasskeyNotMatched();
  error CooldownPeriodNotPassed();
  error ExpiredRequest();

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
