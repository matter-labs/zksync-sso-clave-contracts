// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";

import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { IAllowedSessionsValidator } from "../interfaces/IAllowedSessionsValidator.sol";
import { ISessionKeyValidator } from "../interfaces/ISessionKeyValidator.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import { IModule } from "../interfaces/IModule.sol";
import { IValidatorManager } from "../interfaces/IValidatorManager.sol";
import { SessionLib } from "../libraries/SessionLib.sol";
import { Errors } from "../libraries/Errors.sol";
import { SsoUtils } from "../helpers/SsoUtils.sol";

import { SessionKeyValidator } from "./SessionKeyValidator.sol";

/// @title AllowedSessionsValidator
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev and o.bedrin@xsolla.com
/// @notice This contract is used to manage allowed sessions for a smart account.
contract AllowedSessionsValidator is SessionKeyValidator, AccessControl, IAllowedSessionsValidator {
  using SessionLib for SessionLib.SessionStorage;

  /// @notice Role identifier for session registry managers.
  bytes32 public constant SESSION_REGISTRY_MANAGER_ROLE = keccak256("SESSION_REGISTRY_MANAGER_ROLE");

  /// @notice Mapping to track whether a session actions is allowed.
  /// @dev The key is the hash of session actions, and the value indicates if the actions are allowed.
  mapping(bytes32 sessionActionsHash => bool active) public areSessionActionsAllowed;

  constructor() {
    _grantRole(SESSION_REGISTRY_MANAGER_ROLE, msg.sender);
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  /// @notice Set whether a session actions hash is allowed or not.
  /// @param sessionActionsHash The hash of the session actions.
  /// @param allowed Boolean indicating if the session actions are allowed.
  /// @dev Session actions represent the set of operations, such as fee limits, call policies, and transfer policies,
  /// that define the behavior and constraints of a session.
  function setSessionActionsAllowed(
    bytes32 sessionActionsHash,
    bool allowed
  ) external virtual onlyRole(SESSION_REGISTRY_MANAGER_ROLE) {
    if (areSessionActionsAllowed[sessionActionsHash] != allowed) {
      areSessionActionsAllowed[sessionActionsHash] = allowed;
      emit SessionActionsAllowed(sessionActionsHash, allowed);
    }
  }

  /// @notice Get the hash of session actions from a session specification.
  /// @param sessionSpec The session specification.
  /// @return The hash of the session actions.
  /// @dev The session actions hash is derived from the session's fee limits, call policies, and transfer policies.
  function getSessionActionsHash(SessionLib.SessionSpec memory sessionSpec) public view virtual returns (bytes32) {
    uint256 callPoliciesLength = sessionSpec.callPolicies.length;
    bytes memory callPoliciesEncoded;

    for (uint256 i = 0; i < callPoliciesLength; ++i) {
      SessionLib.CallSpec memory policy = sessionSpec.callPolicies[i];
      callPoliciesEncoded = abi.encodePacked(
        callPoliciesEncoded,
        bytes20(policy.target), // Address cast to bytes20
        policy.selector, // Selector
        policy.maxValuePerUse, // Max value per use
        uint256(policy.valueLimit.limitType), // Limit type
        policy.valueLimit.limit, // Limit
        policy.valueLimit.period // Period
      );
    }

    return keccak256(abi.encode(sessionSpec.feeLimit, sessionSpec.transferPolicies, callPoliciesEncoded));
  }

  /// @notice Create a new session for an account.
  /// @param sessionSpec The session specification to create a session with.
  /// @dev A session is a temporary authorization for an account to perform specific actions, defined by the session specification.
  function createSession(
    SessionLib.SessionSpec memory sessionSpec
  ) public virtual override(SessionKeyValidator, ISessionKeyValidator) {
    bytes32 sessionActionsHash = getSessionActionsHash(sessionSpec);
    if (!areSessionActionsAllowed[sessionActionsHash]) {
      revert Errors.SESSION_ACTIONS_NOT_ALLOWED(sessionActionsHash);
    }
    SessionKeyValidator.createSession(sessionSpec);
  }

  /// @inheritdoc SessionKeyValidator
  function supportsInterface(
    bytes4 interfaceId
  ) public pure override(SessionKeyValidator, AccessControl, IERC165) returns (bool) {
    return
      interfaceId == type(IERC165).interfaceId ||
      interfaceId == type(IModuleValidator).interfaceId ||
      interfaceId == type(IModule).interfaceId ||
      interfaceId == type(IAccessControl).interfaceId;
  }

  /// @notice Validate a session transaction for an account.
  /// @param signedHash The hash of the transaction.
  /// @param transaction The transaction to validate.
  /// @return true if the transaction is valid.
  /// @dev Session spec and period IDs must be provided as validator data.
  function validateTransaction(
    bytes32 signedHash,
    Transaction calldata transaction
  ) public virtual override(SessionKeyValidator, IModuleValidator) returns (bool) {
    // slither-disable-next-line unused-return
    (, , bytes memory validatorData) = SsoUtils.decodeSignature(transaction.signature);
    (SessionLib.SessionSpec memory spec, ) = abi.decode(
      validatorData, // this is passed by the signature builder
      (SessionLib.SessionSpec, uint64[])
    );
    bytes32 sessionActionsHash = getSessionActionsHash(spec);
    if (!areSessionActionsAllowed[sessionActionsHash]) {
      revert Errors.SESSION_ACTIONS_NOT_ALLOWED(sessionActionsHash);
    }
    return super.validateTransaction(signedHash, transaction);
  }
}
