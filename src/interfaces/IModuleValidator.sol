// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { IInitable } from "../interfaces/IInitable.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";

/**
 * @title Modular validator interface for native AA
 * @dev Add signature to module or validate existing signatures for acccount
 */
interface IModuleValidator is IInitable, IERC165 {
  function validateTransaction(
    bytes32 signedHash,
    bytes memory signature,
    Transaction calldata transaction
  ) external returns (bool);

  function validateSignature(bytes32 signedHash, bytes memory signature) external view returns (bool);

  function addValidationKey(bytes memory key) external returns (bool);
}
