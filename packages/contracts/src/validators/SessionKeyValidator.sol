// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../interfaces/IERC7579Module.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { IModule } from "../interfaces/IModule.sol";
import { IValidationHook } from "../interfaces/IHook.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { IHook } from "../interfaces/IERC7579Module.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { IHookManager } from "../interfaces/IHookManager.sol";
import { IValidatorManager } from "../interfaces/IValidatorManager.sol";

library SessionLib {
  using SessionLib for SessionLib.Constraint;
  using SessionLib for SessionLib.UsageLimit;

  // We do not permit session keys to be reused to open multiple sessions
  // (after one expires or is closed, e.g.).
  // For each session key, its session status can only be changed
  // from NotInitialized to Active, and from Active to Closed.
  enum Status {
    NotInitialized,
    Active,
    Closed
  }

  // This struct is used to track usage information for each session.
  // Along with `status`, this is considered the session state.
  // While everything else is considered the session spec, and is stored offchain.
  // Storage layout of this struct is weird to conform to ERC-7562 storage access restrictions during validation.
  // Each innermost mapping is always mapping(address account => ...).
  struct SessionStorage {
    mapping(address => Status) status;
    UsageTracker fee;
    // (target) => transfer value tracker
    mapping(address => UsageTracker) transferValue;
    // (target, selector) => call value tracker
    mapping(address => mapping(bytes4 => UsageTracker)) callValue;
    // (target, selector, index) => call parameter tracker
    // index is the constraint index in callPolicy, not the parameter index
    mapping(address => mapping(bytes4 => mapping(uint256 => UsageTracker))) params;
  }

  struct Constraint {
    Condition condition;
    uint64 index;
    bytes32 refValue;
    UsageLimit limit;
  }

  struct UsageTracker {
    // Used for LimitType.Lifetime
    mapping(address => uint256) lifetimeUsage;
    // Used for LimitType.Allowance
    // period => used that period
    mapping(uint256 => mapping(address => uint256)) allowanceUsage;
  }

  struct UsageLimit {
    LimitType limitType;
    uint256 limit; // ignored if limitType == Unlimited
    uint256 period; // ignored if limitType != Allowance
  }

  enum LimitType {
    Unlimited,
    Lifetime,
    Allowance
  }

  enum Condition {
    Unconstrained,
    Equal,
    Greater,
    Less,
    GreaterOrEqual,
    LessOrEqual,
    NotEqual
  }

  struct SessionSpec {
    address signer;
    uint256 expiresAt;
    UsageLimit feeLimit;
    CallSpec[] callPolicies;
    TransferSpec[] transferPolicies;
  }

  struct CallSpec {
    address target;
    bytes4 selector;
    uint256 maxValuePerUse;
    UsageLimit valueLimit;
    Constraint[] constraints;
    // add max data length restriction?
    // add max number of calls restriction?
  }

  struct TransferSpec {
    address target;
    uint256 maxValuePerUse;
    UsageLimit valueLimit;
  }

  struct LimitState {
    // this might also be limited by a constraint or `maxValuePerUse`,
    // which is not reflected here
    uint256 remaining;
    address target;
    // ignored for transfer value
    bytes4 selector;
    // ignored for transfer and call value
    uint256 index;
  }

  // Info about remaining session limits and its status
  struct SessionState {
    Status status;
    uint256 feesRemaining;
    LimitState[] transferValue;
    LimitState[] callValue;
    LimitState[] callParams;
  }

  function checkAndUpdate(UsageLimit memory limit, UsageTracker storage tracker, uint256 value) internal {
    if (limit.limitType == LimitType.Lifetime) {
      require(tracker.lifetimeUsage[msg.sender] + value <= limit.limit, "Lifetime limit exceeded");
      tracker.lifetimeUsage[msg.sender] += value;
    }
    // TODO: uncomment when it's possible to check timestamps during validation
    // if (limit.limitType == LimitType.Allowance) {
    //   uint256 period = block.timestamp / limit.period;
    //   require(tracker.allowanceUsage[period] + value <= limit.limit);
    //   tracker.allowanceUsage[period] += value;
    // }
  }

  function checkAndUpdate(Constraint memory constraint, UsageTracker storage tracker, bytes calldata data) internal {
    uint256 index = 4 + constraint.index * 32;
    bytes32 param = bytes32(data[index:index + 32]);
    Condition condition = constraint.condition;
    bytes32 refValue = constraint.refValue;

    if (condition == Condition.Equal) {
      require(param == refValue, "EQUAL constraint not met");
    } else if (condition == Condition.Greater) {
      require(param > refValue, "GREATER constraint not met");
    } else if (condition == Condition.Less) {
      require(param < refValue, "LESS constraint not met");
    } else if (condition == Condition.GreaterOrEqual) {
      require(param >= refValue, "GREATER_OR_EQUAL constraint not met");
    } else if (condition == Condition.LessOrEqual) {
      require(param <= refValue, "LESS_OR_EQUAL constraint not met");
    } else if (condition == Condition.NotEqual) {
      require(param != refValue, "NOT_EQUAL constraint not met");
    }

    constraint.limit.checkAndUpdate(tracker, uint256(param));
  }

  function validate(SessionStorage storage state, Transaction calldata transaction, SessionSpec memory spec) internal {
    require(state.status[msg.sender] == Status.Active, "Session is not active");

    // TODO uncomment when it's possible to check timestamps during validation
    // require(block.timestamp <= session.expiresAt);

    // TODO: update fee allowance with the gasleft/refund at the end of execution
    uint256 fee = transaction.maxFeePerGas * transaction.gasLimit;
    spec.feeLimit.checkAndUpdate(state.fee, fee);

    address target = address(uint160(transaction.to));

    if (transaction.data.length >= 4) {
      bytes4 selector = bytes4(transaction.data[:4]);
      CallSpec memory callPolicy;
      bool found = false;

      for (uint256 i = 0; i < spec.callPolicies.length; i++) {
        if (spec.callPolicies[i].target == target && spec.callPolicies[i].selector == selector) {
          callPolicy = spec.callPolicies[i];
          found = true;
          break;
        }
      }

      require(found, "Call not allowed");
      require(transaction.value <= callPolicy.maxValuePerUse, "Value exceeds limit");
      callPolicy.valueLimit.checkAndUpdate(state.callValue[target][selector], transaction.value);

      for (uint256 i = 0; i < callPolicy.constraints.length; i++) {
        callPolicy.constraints[i].checkAndUpdate(state.params[target][selector][i], transaction.data);
      }
    } else {
      TransferSpec memory transferPolicy;
      bool found = false;

      for (uint256 i = 0; i < spec.transferPolicies.length; i++) {
        if (spec.transferPolicies[i].target == target) {
          transferPolicy = spec.transferPolicies[i];
          found = true;
          break;
        }
      }

      require(found, "Transfer not allowed");
      require(transaction.value <= transferPolicy.maxValuePerUse, "Value exceeds limit");
      transferPolicy.valueLimit.checkAndUpdate(state.transferValue[target], transaction.value);
    }
  }

  function remainingLimit(
    UsageLimit memory limit,
    UsageTracker storage tracker,
    address account
  ) internal view returns (uint256) {
    if (limit.limitType == LimitType.Unlimited) {
      // this might be still limited by `maxValuePerUse` or a constraint
      return type(uint256).max;
    }
    if (limit.limitType == LimitType.Lifetime) {
      return limit.limit - tracker.lifetimeUsage[account];
    }
    if (limit.limitType == LimitType.Allowance) {
      // this is not used during validation, so it's fine to use block.timestamp
      uint256 period = block.timestamp / limit.period;
      return limit.limit - tracker.allowanceUsage[period][account];
    }
  }

  function getState(
    SessionStorage storage session,
    address account,
    SessionSpec calldata spec
  ) internal view returns (SessionState memory) {
    uint256 totalConstraints = 0;
    for (uint256 i = 0; i < spec.callPolicies.length; i++) {
      totalConstraints += spec.callPolicies[i].constraints.length;
    }

    LimitState[] memory transferValue = new LimitState[](spec.transferPolicies.length);
    LimitState[] memory callValue = new LimitState[](spec.callPolicies.length);
    LimitState[] memory callParams = new LimitState[](totalConstraints); // there will be empty ones at the end
    uint256 paramLimitIndex = 0;

    for (uint256 i = 0; i < transferValue.length; i++) {
      TransferSpec memory transferSpec = spec.transferPolicies[i];
      transferValue[i] = LimitState({
        remaining: remainingLimit(transferSpec.valueLimit, session.transferValue[transferSpec.target], account),
        target: spec.transferPolicies[i].target,
        selector: bytes4(0),
        index: 0
      });
    }

    for (uint256 i = 0; i < callValue.length; i++) {
      CallSpec memory callSpec = spec.callPolicies[i];
      callValue[i] = LimitState({
        remaining: remainingLimit(callSpec.valueLimit, session.callValue[callSpec.target][callSpec.selector], account),
        target: callSpec.target,
        selector: callSpec.selector,
        index: 0
      });

      for (uint256 j = 0; j < callSpec.constraints.length; j++) {
        if (callSpec.constraints[j].limit.limitType != LimitType.Unlimited) {
          callParams[paramLimitIndex++] = LimitState({
            remaining: remainingLimit(
              callSpec.constraints[j].limit,
              session.params[callSpec.target][callSpec.selector][j],
              account
            ),
            target: callSpec.target,
            selector: callSpec.selector,
            index: callSpec.constraints[j].index
          });
        }
      }
    }

    // shrink array to actual size
    assembly {
      mstore(callParams, paramLimitIndex)
    }

    return
      SessionState({
        status: session.status[account],
        feesRemaining: remainingLimit(spec.feeLimit, session.fee, account),
        transferValue: transferValue,
        callValue: callValue,
        callParams: callParams
      });
  }
}

contract SessionKeyValidator is IHook, IValidationHook, IModuleValidator, IModule {
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
    // this only validates that the session key is linked to the account, not the transaction against the session spec
    return isValidSignature(signedHash, signature) == EIP1271_SUCCESS_RETURN_VALUE;
  }

  function addValidationKey(bytes memory sessionData) external returns (bool) {
    if (sessionData.length == 0) {
      return false;
    }
    SessionLib.SessionSpec memory sessionSpec = abi.decode(sessionData, (SessionLib.SessionSpec));
    createSession(sessionSpec);
    return true;
  }

  function createSession(SessionLib.SessionSpec memory sessionSpec) public {
    bytes32 sessionHash = keccak256(abi.encode(sessionSpec));
    require(_isInitialized(msg.sender), "Account not initialized");
    require(sessionSpec.signer != address(0), "Invalid signer");
    require(sessions[sessionHash].status[msg.sender] == SessionLib.Status.NotInitialized, "Session already exists");
    require(sessionSpec.feeLimit.limitType != SessionLib.LimitType.Unlimited, "Unlimited fee allowance is not safe");
    sessionCounter[msg.sender]++;
    sessions[sessionHash].status[msg.sender] = SessionLib.Status.Active;
    emit SessionCreated(msg.sender, sessionHash, sessionSpec);
  }

  function init(bytes calldata data) external {
    // to prevent recursion, since addHook also calls init
    if (!_isInitialized(msg.sender)) {
      IHookManager(msg.sender).addHook(abi.encodePacked(address(this)), true);
      IValidatorManager(msg.sender).addModuleValidator(address(this), data);
    }
  }

  function onInstall(bytes calldata data) external override {
    // TODO
  }

  function onUninstall(bytes calldata) external override {
    // TODO
    _uninstall();
  }

  function disable() external {
    if (_isInitialized(msg.sender)) {
      _uninstall();
      IValidatorManager(msg.sender).removeModuleValidator(address(this));
      IHookManager(msg.sender).removeHook(address(this), true);
    }
  }

  function _uninstall() internal {
    // Here we have to revoke all keys, so that if the module
    // is installed again later, there will be no active sessions from the past.
    // Problem: if there are too many keys, this will run out of gas.
    // Solution: before uninstalling, require that all keys are revoked manually.
    require(sessionCounter[msg.sender] == 0, "Revoke all keys first");
  }

  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return
      interfaceId != 0xffffffff &&
      (interfaceId == type(IERC165).interfaceId ||
        interfaceId == type(IValidationHook).interfaceId ||
        interfaceId == type(IModuleValidator).interfaceId ||
        interfaceId == type(IModule).interfaceId);
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
   * If there are any spend limits configured
   * @param smartAccount The smart account to check
   * @return true if spend limits are configured initialized, false otherwise
   */
  function isInitialized(address smartAccount) external view returns (bool) {
    return _isInitialized(smartAccount);
  }

  function _isInitialized(address smartAccount) internal view returns (bool) {
    return IHookManager(smartAccount).isHook(address(this));
    // && IValidatorManager(smartAccount).isModuleValidator(address(this));
  }

  /*
   * Currently doing 1271 validation, but might update the interface to match the zksync account validation
   */
  function isValidSignature(bytes32 hash, bytes memory signature) public view returns (bytes4 magic) {
    magic = EIP1271_SUCCESS_RETURN_VALUE;
    // TODO: Does this method have to work standalone? If not, validationHook is sufficient for validation.
  }

  function validationHook(bytes32 signedHash, Transaction calldata transaction, bytes calldata hookData) external {
    (bytes memory signature, address validator, ) = abi.decode(transaction.signature, (bytes, address, bytes[]));
    if (validator != address(this)) {
      // This transaction is not meant to be validated by this module
      return;
    }
    SessionLib.SessionSpec memory spec = abi.decode(hookData, (SessionLib.SessionSpec));
    (address recoveredAddress, ) = ECDSA.tryRecover(signedHash, signature);
    require(recoveredAddress == spec.signer, "Invalid signer");
    bytes32 sessionHash = keccak256(abi.encode(spec));
    sessions[sessionHash].validate(transaction, spec);
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

  /*
   * Does validation and hooks transaction depending on the key
   * @param typeID The type ID to check
   * @return true if the module is of the given type, false otherwise
   */
  function isModuleType(uint256 typeID) external pure override returns (bool) {
    return typeID == MODULE_TYPE_VALIDATOR;
  }

  /*
   * Look at the transaction data to parse out what needs to be done
   */
  function preCheck(
    address msgSender,
    uint256 msgValue,
    bytes calldata msgData
  ) external returns (bytes memory hookData) {}

  /*
   * Validate data from the pre-check hook after the transaction is executed
   */
  function postCheck(bytes calldata hookData) external {}
}
