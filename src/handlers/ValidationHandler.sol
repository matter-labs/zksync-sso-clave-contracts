// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";

import { SignatureDecoder } from "../libraries/SignatureDecoder.sol";
import { OwnerManager } from "../managers/OwnerManager.sol";
import { ValidatorManager } from "../managers/ValidatorManager.sol";

import { IModuleValidator } from "../interfaces/IModuleValidator.sol";

/**
 * @title ValidationHandler
 * @notice Contract which calls validators for signature validation
 * @author https://getclave.io
 */
abstract contract ValidationHandler is OwnerManager, ValidatorManager {
  function _handleValidation(
    address validator,
    bytes32 signedHash,
    bytes memory signature,
    Transaction calldata transaction
  ) internal returns (bool) {
    if (_isModuleValidator(validator)) {
      return IModuleValidator(validator).validateTransaction(signedHash, signature, transaction);
    }

    return false;
  }
}
