// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ERC165Checker } from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import { ExcessivelySafeCall } from "@nomad-xyz/excessively-safe-call/src/ExcessivelySafeCall.sol";

import { SsoStorage } from "../libraries/SsoStorage.sol";
import { Auth } from "../auth/Auth.sol";
import { AddressLinkedList } from "../libraries/LinkedList.sol";
import { Errors } from "../libraries/Errors.sol";
import { IModule } from "../interfaces/IModule.sol";
import { IInitable } from "../interfaces/IInitable.sol";
import { ISsoAccount } from "../interfaces/ISsoAccount.sol";
import { IModuleManager } from "../interfaces/IModuleManager.sol";
import { IERC7579Module, IExecutor } from "../interfaces/IERC7579Module.sol";

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

  /// @inheritdoc IModuleManager
  function addModule(bytes calldata moduleAndData) external override onlySelfOrModule {
    _addModule(moduleAndData);
  }

  /// @inheritdoc IModuleManager
  function removeModule(address module) external override onlySelfOrModule {
    _removeModule(module);
  }

  /// @inheritdoc IModuleManager
  function executeFromModule(address to, uint256 value, bytes memory data) external override onlyModule {
    if (to == address(this)) revert Errors.RECURSIVE_MODULE_CALL();

    assembly {
      let result := call(gas(), to, value, add(data, 0x20), mload(data), 0, 0)
      if iszero(result) {
        returndatacopy(0, 0, returndatasize())
        revert(0, returndatasize())
      }
    }
  }

  /// @inheritdoc IModuleManager
  function isModule(address addr) external view override returns (bool) {
    return _isModule(addr);
  }

  /// @inheritdoc IModuleManager
  function listModules() external view override returns (address[] memory moduleList) {
    moduleList = _modulesLinkedList().list();
  }

  function _addNativeModule(address moduleAddress, bytes memory moduleData) internal {
    if (!_supportsModule(moduleAddress)) {
      revert Errors.MODULE_ERC165_FAIL();
    }

    _modulesLinkedList().add(moduleAddress);

    IModule(moduleAddress).init(moduleData);

    emit AddModule(moduleAddress);
  }

  function _addModule(bytes calldata moduleAndData) internal {
    if (moduleAndData.length < 20) {
      revert Errors.EMPTY_MODULE_ADDRESS();
    }

    address moduleAddress = address(bytes20(moduleAndData[0:20]));
    bytes calldata initData = moduleAndData[20:];

    if (!_supportsModule(moduleAddress)) {
      revert Errors.MODULE_ERC165_FAIL();
    }

    _modulesLinkedList().add(moduleAddress);

    IModule(moduleAddress).init(initData);

    emit AddModule(moduleAddress);
  }

  function _addExternalExecutorPermission(address module, bytes calldata data) internal virtual {
    _externalExecutorModule().add(module);

    IERC7579Module(module).onInstall(data);

    emit AddModule(module);
  }

  function _addFallbackModule(address module, bytes calldata data) internal virtual {
    SsoStorage.layout().fallbackContractBySelector[bytes4(data[0:4])] = module;

    IERC7579Module(module).onInstall(data);

    emit AddModule(module);
  }

  function _removeFallbackModule(address module, bytes calldata data) internal virtual {
    SsoStorage.layout().fallbackContractBySelector[bytes4(data[0:4])] = address(0);

    IERC7579Module(module).onUninstall(data);

    emit RemoveModule(module);
  }

  function _removeModule(address module) internal {
    _modulesLinkedList().remove(module);

    (bool success, ) = module.excessivelySafeCall(gasleft(), 0, abi.encodeWithSelector(IInitable.disable.selector));
    (success); // silence unused local variable warning

    emit RemoveModule(module);
  }

  function _isModule(address addr) internal view override returns (bool) {
    return _modulesLinkedList().exists(addr);
  }

  function _modulesLinkedList() private view returns (mapping(address => address) storage modules) {
    modules = SsoStorage.layout().modules;
  }

  function _externalExecutorModule() private view returns (mapping(address => address) storage modules) {
    modules = SsoStorage.layout().execModules;
  }

  function _removeExternalExecutorModule(address module, bytes calldata data) internal {
    _externalExecutorModule().remove(module);

    IExecutor(module).onUninstall(data);

    emit RemoveModule(module);
  }

  function _supportsModule(address module) internal view returns (bool) {
    // this is pretty dumb, since type(IModule).interfaceId is 0x00000000, but is correct as per ERC165
    // context: https://github.com/ethereum/solidity/issues/7856#issuecomment-585337461
    return module.supportsInterface(type(IModule).interfaceId);
  }
}
