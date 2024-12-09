// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { IInitable } from "../interfaces/IInitable.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IExecutionHook is IInitable, IERC165 {
  function preExecutionHook(Transaction calldata transaction) external returns (bytes memory context);

  function postExecutionHook(bytes memory context) external;
}
