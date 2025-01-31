// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IModuleValidator } from "./IModuleValidator.sol";
import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";

interface IGuardianRecoveryValidator is IModuleValidator {
  struct GuardianConfirmation {
    address ssoAccount;
  }

  function proposeValidationKey(address externalAccount) external;

  function removeValidationKey(address externalAccount) external;

  function initRecovery(address accountToRecover, bytes memory passkey) external;

  function addValidationKey(bytes memory key) external returns (bool);

  function validateTransaction(
    bytes32 signedHash,
    bytes memory signature,
    Transaction calldata transaction
  ) external returns (bool);

  function validateSignature(bytes32 signedHash, bytes memory signature) external view returns (bool);
}
