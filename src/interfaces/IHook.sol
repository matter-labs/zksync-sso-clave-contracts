// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { IInitable } from "../interfaces/IInitable.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

// Validation hooks are a non-standard way to always perform validation,
// They can't expect any specific transaction data or signature, but can be used to enforce
// additional restrictions on the account during the validation phase
interface IValidationHook is IInitable, IERC165 {
  function validationHook(bytes32 signedHash, Transaction calldata transaction) external;
}

interface IExecutionHook is IInitable, IERC165 {
  function preExecutionHook(Transaction calldata transaction) external returns (bytes memory context);

  function postExecutionHook() external;
}
