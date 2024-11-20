// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SystemContractHelper } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractHelper.sol";
import { EfficientCall } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/EfficientCall.sol";
import { Errors } from "../libraries/Errors.sol";

// Each call data for batches
struct Call {
  address target; // Target contract address
  bool allowFailure; // Whether to revert if the call fails
  uint256 value; // Amount of ETH to send with call
  bytes callData; // Calldata to send
}

/// @title BatchCaller
/// @notice Make multiple calls in a single transaction
contract BatchCaller {
  /// @notice Make multiple calls, ensure success if required
  /// @dev Reverts if not called via delegatecall
  /// @param calls Call[] calldata - An array of Call structs
  function batchCall(Call[] calldata calls) external payable {
    require(msg.sender == address(this), "External calls not allowed");

    // Execute each call
    uint256 len = calls.length;
    uint256 totalValue = 0;
    for (uint256 i = 0; i < len; ) {
      totalValue += calls[i].value;
      bool success = EfficientCall.rawCall(gasleft(), calls[i].target, calls[i].value, calls[i].callData, false);
      if (!calls[i].allowFailure && !success) {
        revert Errors.CALL_FAILED();
      }

      unchecked {
        i++;
      }
    }

    require(totalValue == msg.value, "Incorrect value for batch call");
  }
}
