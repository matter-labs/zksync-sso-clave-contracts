// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IBatchCaller
/// @notice Interface that allows making multiple external calls in a single transaction.
interface IBatchCaller {
  /// @dev Represents an external call data.
  /// @param target The address to which the call will be made.
  /// @param allowFailure Flag that represents whether to revert the whole batch if the call fails.
  /// @param value The amount of Ether (in wei) to be sent along with the call.
  /// @param callData The calldata to be executed on the `target` address.
  struct Call {
    address target;
    bool allowFailure;
    uint256 value;
    bytes callData;
  }

  /// @notice Emits information about a failed call.
  /// @param index The index of the failed call in the batch.
  /// @param revertData The return data of the failed call.
  event BatchCallFailure(uint256 indexed index, bytes revertData);

  /// @notice Make multiple calls, ensure success if required.
  /// @dev The total Ether sent across all calls must be equal to `msg.value` to maintain the invariant
  /// that `msg.value` + `tx.fee` is the maximum amount of Ether that can be spent on the transaction.
  /// @param _calls Array of Call structs, each representing an individual external call to be made.
  function batchCall(Call[] calldata _calls) external payable;
}
