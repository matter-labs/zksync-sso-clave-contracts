// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/**
 * @title Interface of the manager contract for modules
 * @author https://getclave.io
 */
interface IModuleManager {
  /**
   * @notice Event emitted when a module is removed
   * @param module address - Address of the removed module
   */
  event RemoveModule(address indexed module);
}
