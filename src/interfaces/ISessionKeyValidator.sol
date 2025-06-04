// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IModuleValidator } from "./IModuleValidator.sol";
import { SessionLib } from "../libraries/SessionLib.sol";

/// @title ISessionKeyValidator
interface ISessionKeyValidator is IModuleValidator {
  /// @notice Emitted when a session is created
  /// @param account The address of the account that created the session
  /// @param sessionHash The hash of the session spec
  /// @param sessionSpec The full session specification
  event SessionCreated(address indexed account, bytes32 indexed sessionHash, SessionLib.SessionSpec sessionSpec);
  /// @notice Emitted when a session is revoked
  /// @param account The address of the account that revoked the session
  /// @param sessionHash The hash of the session spec that was revoked
  event SessionRevoked(address indexed account, bytes32 indexed sessionHash);

  function isInitialized(address smartAccount) external view returns (bool);
  function createSession(SessionLib.SessionSpec memory sessionSpec) external;
  function revokeKey(bytes32 sessionHash) external;
  function revokeKeys(bytes32[] calldata sessionHashes) external;
  function sessionStatus(address account, bytes32 sessionHash) external view returns (SessionLib.Status);
  function sessionState(
    address account,
    SessionLib.SessionSpec calldata spec
  ) external view returns (SessionLib.SessionState memory);
}
