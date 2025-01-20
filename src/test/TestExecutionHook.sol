// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IExecutionHook } from "../interfaces/IHook.sol";
import { IModule } from "../interfaces/IModule.sol";

contract TestExecutionHook is IExecutionHook {
  event PreExecution();
  event PostExecution();

  function onInstall(bytes calldata) external {}
  function onUninstall(bytes calldata) external {}

  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return interfaceId == type(IExecutionHook).interfaceId || interfaceId == type(IModule).interfaceId;
  }

  function preExecutionHook(Transaction calldata transaction) external override returns (bytes memory context) {
    return abi.encodePacked("preExecutionHook");
  }

  function postExecutionHook(bytes calldata context) external override {
    require(
      keccak256(abi.encodePacked(context)) == keccak256(abi.encodePacked("preExecutionHook")),
      "context should be preExecutionHook"
    );
  }
}
