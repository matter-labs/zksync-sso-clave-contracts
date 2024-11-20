// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC7579Module } from "./IERC7579Module.sol";
import { PackedUserOperation } from "./PackedUserOperation.sol";

interface IUserOpValidator is IERC7579Module {
  error InvalidTargetAddress(address target);

  /**
   * @dev Validates a transaction on behalf of the account.
   *         This function is intended to be called by the MSA during the ERC-4337 validation phase
   *         Note: solely relying on bytes32 hash and signature is not sufficient for some
   * validation implementations (i.e. SessionKeys often need access to userOp.calldata)
   * @param userOp The user operation to be validated. The userOp MUST NOT contain any metadata.
   * The MSA MUST clean up the userOp before sending it to the validator.
   * @param userOpHash The hash of the user operation to be validated
   * @return return value according to ERC-4337
   */
  function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash) external returns (uint256);

  /**
   * Validator can be used for ERC-1271 validation
   */
  function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata data) external view returns (bytes4);
}
