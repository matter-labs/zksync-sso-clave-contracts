// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { SignatureDecoder } from "../libraries/SignatureDecoder.sol";
import { BytesLinkedList } from "../libraries/LinkedList.sol";
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
    bytes memory signature
  ) internal view returns (bool) {
    if (_isModuleValidator(validator)) {
      return IModuleValidator(validator).handleValidation(signedHash, signature);
    }

    return false;
  }
}
