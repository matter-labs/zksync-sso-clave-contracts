// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { EfficientCall } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/EfficientCall.sol";
import { SsoUtils } from "../helpers/SsoUtils.sol";
import { Errors } from "../libraries/Errors.sol";
import { SelfAuth } from "../auth/SelfAuth.sol";
import { INoHooksCaller } from "../interfaces/INoHooksCaller.sol";

/// @title NoHooksCaller
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @notice Bypass all installed hooks in case any are malicious, misconfigured, or wrongly prevent execution.
abstract contract NoHooksCaller is SelfAuth, INoHooksCaller {
  /// @inheritdoc INoHooksCaller
  function noHooksCall(address target, uint256 value, bytes calldata callData) external payable onlySelf {
    if (msg.value != value) {
      revert Errors.MSG_VALUE_MISMATCH(msg.value, value);
    }

    bool success = SsoUtils.performCall(target, value, callData);

    if (!success) {
      // Revert with the return data from the failed call
      EfficientCall.propagateRevert();
    }
  }
}
