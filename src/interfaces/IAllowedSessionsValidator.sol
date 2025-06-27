// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ISessionKeyValidator } from "./ISessionKeyValidator.sol";
import { SessionLib } from "../libraries/SessionLib.sol";

/// @title IAllowedSessionsValidator
interface IAllowedSessionsValidator is ISessionKeyValidator {
  /// @notice Emitted when session actions are allowed or disallowed.
  /// @param sessionActionsHash The hash of the session actions.
  /// @param allowed Boolean indicating if the session actions are allowed.
  event SessionActionsAllowed(bytes32 indexed sessionActionsHash, bool indexed allowed);

  function setSessionActionsAllowed(bytes32 sessionActionsHash, bool allowed) external;
  function getSessionActionsHash(SessionLib.SessionSpec memory sessionSpec) external view returns (bytes32);
}
