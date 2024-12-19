// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { IModuleValidator } from "../interfaces/IModuleValidator.sol";

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { IValidatorManager } from "../interfaces/IValidatorManager.sol";
import { SessionLib } from "../libraries/SessionLib.sol";
import { SignatureDecoder } from "../libraries/SignatureDecoder.sol";

contract SessionKeyValidator is IModuleValidator {
  using SessionLib for SessionLib.SessionStorage;
  using EnumerableSet for EnumerableSet.Bytes32Set;

  event SessionCreated(address indexed account, bytes32 indexed sessionHash, SessionLib.SessionSpec sessionSpec);
  event SessionRevoked(address indexed account, bytes32 indexed sessionHash);

  bytes4 constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;

  // account => number of open sessions
  // NOTE: expired sessions are still counted if not explicitly revoked
  mapping(address => uint256) private sessionCounter;
  // session hash => session state
  mapping(bytes32 => SessionLib.SessionStorage) private sessions;

  function sessionState(
    address account,
    SessionLib.SessionSpec calldata spec
  ) external view returns (SessionLib.SessionState memory) {
    return sessions[keccak256(abi.encode(spec))].getState(account, spec);
  }

  function sessionStatus(address account, bytes32 sessionHash) external view returns (SessionLib.Status) {
    return sessions[sessionHash].status[account];
  }

  // This module should not be used to validate signatures
  function validateSignature(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    return false;
  }

  function addValidationKey(bytes memory key) external returns (bool) {
    return _addValidationKey(key);
  }

  function createSession(SessionLib.SessionSpec memory sessionSpec) public {
    bytes32 sessionHash = keccak256(abi.encode(sessionSpec));
    require(isInitialized(msg.sender), "Account not initialized");
    require(sessionSpec.signer != address(0), "Invalid signer (create)");
    require(sessions[sessionHash].status[msg.sender] == SessionLib.Status.NotInitialized, "Session already exists");
    require(sessionSpec.feeLimit.limitType != SessionLib.LimitType.Unlimited, "Unlimited fee allowance is not safe");
    sessionCounter[msg.sender]++;
    sessions[sessionHash].status[msg.sender] = SessionLib.Status.Active;
    emit SessionCreated(msg.sender, sessionHash, sessionSpec);
  }

  function init(bytes calldata data) external {
    if (data.length != 0) {
      require(_addValidationKey(data), "Init failed");
    }
  }

  function _addValidationKey(bytes memory sessionData) internal returns (bool) {
    SessionLib.SessionSpec memory sessionSpec = abi.decode(sessionData, (SessionLib.SessionSpec));
    createSession(sessionSpec);
    return true;
  }

  function disable() external {
    if (isInitialized(msg.sender)) {
      // Here we have to revoke all keys, so that if the module
      // is installed again later, there will be no active sessions from the past.
      // Problem: if there are too many keys, this will run out of gas.
      // Solution: before uninstalling, require that all keys are revoked manually.
      require(sessionCounter[msg.sender] == 0, "Revoke all keys first");
      IValidatorManager(msg.sender).removeModuleValidator(address(this));
    }
  }

  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return
      interfaceId != 0xffffffff &&
      (interfaceId == type(IERC165).interfaceId || interfaceId == type(IModuleValidator).interfaceId);
  }

  // TODO: make the session owner able revoke its own key, in case it was leaked, to prevent further misuse?
  function revokeKey(bytes32 sessionHash) public {
    require(sessions[sessionHash].status[msg.sender] == SessionLib.Status.Active, "Nothing to revoke");
    sessions[sessionHash].status[msg.sender] = SessionLib.Status.Closed;
    sessionCounter[msg.sender]--;
    emit SessionRevoked(msg.sender, sessionHash);
  }

  function revokeKeys(bytes32[] calldata sessionHashes) external {
    for (uint256 i = 0; i < sessionHashes.length; i++) {
      revokeKey(sessionHashes[i]);
    }
  }

  /*
   * Check if the validator is registered for the smart account
   * @param smartAccount The smart account to check
   * @return true if validator is registered for the account, false otherwise
   */
  function isInitialized(address smartAccount) public view returns (bool) {
    return IValidatorManager(smartAccount).isModuleValidator(address(this));
  }

  function validateTransaction(
    bytes32 signedHash,
    bytes memory _signature,
    Transaction calldata transaction
  ) external returns (bool) {
    (bytes memory transactionSignature, address validator, bytes memory validatorData) = SignatureDecoder
      .decodeSignature(transaction.signature);
    (SessionLib.SessionSpec memory spec, uint64[] memory periodIds) = abi.decode(
      validatorData, // this is passed by the signature builder
      (SessionLib.SessionSpec, uint64[])
    );
    require(spec.signer != address(0), "Invalid signer (empty)");
    bytes32 sessionHash = keccak256(abi.encode(spec));
    // this generally throws instead of returning false
    sessions[sessionHash].validate(transaction, spec, periodIds);
    (address recoveredAddress, ECDSA.RecoverError recoverError) = ECDSA.tryRecover(signedHash, transactionSignature);
    if (recoverError != ECDSA.RecoverError.NoError || recoveredAddress == address(0)) {
      return false;
    }
    require(recoveredAddress == spec.signer, "Invalid signer (mismatch)");
    // This check is separate and performed last to prevent gas estimation failures
    sessions[sessionHash].validateFeeLimit(transaction, spec, periodIds[0]);
    return true;
  }

  /**
   * The name of the module
   * @return name The name of the module
   */
  function name() external pure returns (string memory) {
    return "SessionKeyValidator";
  }

  /**
   * Currently in dev
   * @return version The version of the module
   */
  function version() external pure returns (string memory) {
    return "0.0.0";
  }
}
