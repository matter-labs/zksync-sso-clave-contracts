// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ERC165Checker } from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import { ExcessivelySafeCall } from "@nomad-xyz/excessively-safe-call/src/ExcessivelySafeCall.sol";

import { SsoStorage } from "../libraries/SsoStorage.sol";
import { Auth } from "../auth/Auth.sol";
import { AddressLinkedList } from "../libraries/LinkedList.sol";
import { Errors } from "../libraries/Errors.sol";
import { IInitable } from "../interfaces/IInitable.sol";
import { ISsoAccount } from "../interfaces/ISsoAccount.sol";
import { IModuleManager } from "../interfaces/IModuleManager.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";

/**
 * @title Manager contract for modules
 * @notice Abstract contract for managing the enabled modules of the account
 * @dev Module addresses are stored in a linked list
 * @author https://getclave.io
 */
abstract contract ModuleManager is IModuleManager, Auth {
  // Helper library for address to address mappings
  using AddressLinkedList for mapping(address => address);
  // Interface helper library
  using ERC165Checker for address;
  // Low level calls helper library
  using ExcessivelySafeCall for address;

  function _supportsModule(address module) internal view returns (bool) {
    // this is pretty dumb, since type(IModule).interfaceId is 0x00000000, but is correct as per ERC165
    // context: https://github.com/ethereum/solidity/issues/7856#issuecomment-585337461
    return module.supportsInterface(type(IModuleValidator).interfaceId);
  }
}
