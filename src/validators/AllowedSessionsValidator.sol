// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";

import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import { IModule } from "../interfaces/IModule.sol";
import { IValidatorManager } from "../interfaces/IValidatorManager.sol";
import { SessionLib } from "../libraries/SessionLib.sol";
import { Errors } from "../libraries/Errors.sol";
import { SignatureDecoder } from "../libraries/SignatureDecoder.sol";

import { SessionKeyValidator } from "./SessionKeyValidator.sol";

/// @title AllowedSessionsValidator
/// @author Oleg Bedrin - <o.bedrin@xsolla.com> - Xsolla Special Initiatives
/// @custom:security-contact security@matterlabs.dev and o.bedrin@xsolla.com
/// @notice This contract is used to manage allowed sessions for a smart account.
contract AllowedSessionsValidator is SessionKeyValidator, AccessControl {
  using SessionLib for SessionLib.SessionStorage;

  /// @notice Role identifier for session registry managers.
  bytes32 public constant SESSION_REGISTRY_MANAGER_ROLE = keccak256("SESSION_REGISTRY_MANAGER_ROLE");

  /// @notice Mapping to track whether a session actions is allowed.
  /// @dev The key is the hash of session actions, and the value indicates if the actions are allowed.
  mapping(bytes32 sessionActionsHash => bool active) public isSessionSpecAllowed;

  /// @notice Emitted when session actions are allowed or disallowed.
  /// @param sessionActionsHash The hash of the session actions.
  /// @param allowed Boolean indicating if the session actions are allowed.
  event SessionActionsAllowed(bytes32 sessionActionsHash, bool allowed);

  /// @notice Error indicating that the session actions are not allowed.
  /// @param sessionActionsHash The hash of the session actions that are not allowed.
  error SessionActionsNotAllowed(bytes32 sessionActionsHash);

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
    isSessionSpecAllowed[sessionActionsHash] = allowed;
    emit SessionActionsAllowed(sessionActionsHash, allowed);
  }

  /// @notice Get the hash of session actions from a session specification.
  /// @param sessionSpec The session specification.
  /// @return The hash of the session actions.
  /// @dev The session actions hash is derived from the session's fee limits, call policies, and transfer policies.
  function getSessionActionsHash(SessionLib.SessionSpec memory sessionSpec) public view virtual returns (bytes32) {
    return keccak256(abi.encode(sessionSpec.feeLimit, sessionSpec.callPolicies, sessionSpec.transferPolicies));
  }

  /// @notice Create a new session for an account.
  /// @param sessionSpec The session specification to create a session with.
  /// @dev A session is a temporary authorization for an account to perform specific actions, defined by the session specification.
  function createSession(SessionLib.SessionSpec memory sessionSpec) public virtual override {
    bytes32 sessionActionsHash = getSessionActionsHash(sessionSpec);
    if (!isSessionSpecAllowed[sessionActionsHash]) {
      revert SessionActionsNotAllowed(sessionActionsHash);
    }
    super.createSession(sessionSpec);
  }

  /// @inheritdoc SessionKeyValidator
  function supportsInterface(
    bytes4 interfaceId
  ) public pure override(SessionKeyValidator, AccessControl) returns (bool) {
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
  ) external virtual override returns (bool) {
    (bytes memory transactionSignature, address _validator, bytes memory validatorData) = SignatureDecoder
      .decodeSignature(transaction.signature);
    (SessionLib.SessionSpec memory spec, uint64[] memory periodIds) = abi.decode(
      validatorData, // this is passed by the signature builder
      (SessionLib.SessionSpec, uint64[])
    );
    if (spec.signer == address(0)) {
      revert Errors.SESSION_ZERO_SIGNER();
    }
    bytes32 sessionActionsHash = getSessionActionsHash(spec);
    if (!isSessionSpecAllowed[sessionActionsHash]) {
      revert SessionActionsNotAllowed(sessionActionsHash);
    }
    bytes32 sessionHash = keccak256(abi.encode(spec));
    // this generally throws instead of returning false
    sessions[sessionHash].validate(transaction, spec, periodIds);
    (address recoveredAddress, ECDSA.RecoverError recoverError) = ECDSA.tryRecover(signedHash, transactionSignature);
    if (recoverError != ECDSA.RecoverError.NoError || recoveredAddress == address(0)) {
      return false;
    }
    if (recoveredAddress != spec.signer) {
      revert Errors.SESSION_INVALID_SIGNER(recoveredAddress, spec.signer);
    }
    // This check is separate and performed last to prevent gas estimation failures
    sessions[sessionHash].validateFeeLimit(transaction, spec, periodIds[0]);
    return true;
  }
}
