// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { IValidationHook } from "../interfaces/IHook.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { IHookManager } from "../interfaces/IHookManager.sol";
import { IValidatorManager } from "../interfaces/IValidatorManager.sol";
import { SessionLib } from "../libraries/SessionLib.sol";

contract SessionKeyValidator is IValidationHook, IModuleValidator {
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

  function handleValidation(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    // This only succeeds if the validationHook has previously succeeded for this hash.
    uint256 slot = uint256(signedHash);
    uint256 hookResult;
    assembly {
      hookResult := tload(slot)
    }
    require(hookResult == 1, "Can't call this function without calling validationHook");
    return true;
  }

  function addValidationKey(bytes memory sessionData) external returns (bool) {
    return _addValidationKey(sessionData);
  }

  function createSession(SessionLib.SessionSpec memory sessionSpec) public {
    bytes32 sessionHash = keccak256(abi.encode(sessionSpec));
    require(_isHookInitialized(msg.sender), "Account not initialized");
    require(sessionSpec.signer != address(0), "Invalid signer");
    require(sessions[sessionHash].status[msg.sender] == SessionLib.Status.NotInitialized, "Session already exists");
    require(sessionSpec.feeLimit.limitType != SessionLib.LimitType.Unlimited, "Unlimited fee allowance is not safe");
    sessionCounter[msg.sender]++;
    sessions[sessionHash].status[msg.sender] = SessionLib.Status.Active;
    emit SessionCreated(msg.sender, sessionHash, sessionSpec);
  }

  function init(bytes calldata data) external {
    // to prevent duplicate inits, since this can be hook plus a validator
    if (!_isHookAndModuleInitialized(msg.sender) && data.length != 0) {
      require(_addValidationKey(data), "init failed");
    }
  }

  function _addValidationKey(bytes memory sessionData) internal returns (bool) {
    SessionLib.SessionSpec memory sessionSpec = abi.decode(sessionData, (SessionLib.SessionSpec));
    createSession(sessionSpec);
    return true;
  }

  function disable() external {
    // Here we have to revoke all keys, so that if the module
    // is installed again later, there will be no active sessions from the past.
    // Problem: if there are too many keys, this will run out of gas.
    // Solution: before uninstalling, require that all keys are revoked manually.
    require(sessionCounter[msg.sender] == 0, "Revoke all keys first");

    // Check module and hook independently so it's not stuck in a bad state
    if (_isHookInitialized(msg.sender)) {
      IHookManager(msg.sender).removeHook(address(this), true);
    }
    if (_isModuleInitialized(msg.sender)) {
      IValidatorManager(msg.sender).removeModuleValidator(address(this));
    }
  }

  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return
      interfaceId != 0xffffffff &&
      (interfaceId == type(IERC165).interfaceId ||
        interfaceId == type(IValidationHook).interfaceId ||
        interfaceId == type(IModuleValidator).interfaceId);
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
  function isInitialized(address smartAccount) external view returns (bool) {
    return _isHookAndModuleInitialized(smartAccount);
  }

  function _isHookAndModuleInitialized(address smartAccount) internal view returns (bool) {
    return _isHookInitialized(smartAccount) && _isModuleInitialized(smartAccount);
  }

  function _isHookInitialized(address smartAccount) internal view returns (bool) {
    return IHookManager(smartAccount).isHook(address(this));
  }

  function _isModuleInitialized(address smartAccount) internal view returns (bool) {
    return IValidatorManager(smartAccount).isModuleValidator(address(this));
  }

  function validationHook(bytes32 signedHash, Transaction calldata transaction, bytes calldata hookData) external {
    (bytes memory signature, address validator, ) = abi.decode(transaction.signature, (bytes, address, bytes[]));
    if (validator != address(this)) {
      // This transaction is not meant to be validated by this module
      return;
    }
    (SessionLib.SessionSpec memory spec, uint64[] memory periodIds) = abi.decode(
      hookData,
      (SessionLib.SessionSpec, uint64[])
    );
    (address recoveredAddress, ) = ECDSA.tryRecover(signedHash, signature);
    require(recoveredAddress == spec.signer, "Invalid signer");
    bytes32 sessionHash = keccak256(abi.encode(spec));
    sessions[sessionHash].validate(transaction, spec, periodIds);

    // Set the validation result to 1 for this hash, so that isValidSignature succeeds
    uint256 slot = uint256(signedHash);
    assembly {
      tstore(slot, 1)
    }
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
