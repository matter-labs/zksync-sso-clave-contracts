// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { IInitable } from "../interfaces/IInitable.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * @title Modular validator interface for native AA
 * @dev Add signature to module or validate existing signatures for acccount
 */
interface IModuleValidator is IInitable, IERC165 {
  function handleValidation(bytes32 signedHash, bytes memory signature) external view returns (bool);

  function addValidationKey(bytes memory key) external returns (bool);
}
