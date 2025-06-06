// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { EfficientCall } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/EfficientCall.sol";
import { SsoUtils } from "../helpers/SsoUtils.sol";
import { Errors } from "../libraries/Errors.sol";
import { SelfAuth } from "../auth/SelfAuth.sol";
import { IBatchCaller } from "../interfaces/IBatchCaller.sol";

/// @title BatchCaller
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @notice Make multiple calls from Account in a single transaction.
/// @notice The implementation is inspired by Clave wallet.
abstract contract BatchCaller is SelfAuth, IBatchCaller {
  /// @inheritdoc IBatchCaller
  function batchCall(Call[] calldata _calls) external payable onlySelf {
    uint256 totalValue;
    uint256 len = _calls.length;

    for (uint256 i = 0; i < len; ++i) {
      totalValue += _calls[i].value;
      bool success = SsoUtils.performCall(_calls[i].target, _calls[i].value, _calls[i].callData);

      if (!success) {
        emit BatchCallFailure(i, getReturnData());
        if (!_calls[i].allowFailure) {
          EfficientCall.propagateRevert();
        }
      }
    }

    if (totalValue != msg.value) {
      revert Errors.MSG_VALUE_MISMATCH(msg.value, totalValue);
    }
  }

  function getReturnData() private pure returns (bytes memory data) {
    assembly {
      let size := returndatasize()
      data := mload(0x40)
      mstore(0x40, add(data, add(size, 0x20)))
      mstore(data, size)
      returndatacopy(add(data, 0x20), 0, size)
    }
  }
}
