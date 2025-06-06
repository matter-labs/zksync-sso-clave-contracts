// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title INoHooksCaller
/// @notice Interface that allows bypassing installed hooks
interface INoHooksCaller {
  /// @notice Make a call to a target address without invoking any installed hooks.
  /// @dev This is desirable when e.g. any of the installed hooks constantly revert,
  /// run out of gas, are malicious, or misconfigured.
  /// @param target The address to which the call will be made.
  /// @param value The amount of Ether to be sent along with the call.
  /// @param callData The data to be sent with the call.
  function noHooksCall(address target, uint256 value, bytes calldata callData) external payable;
}
