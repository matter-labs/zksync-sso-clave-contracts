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

  uint256 constant MAX_CONSTRAINTS = 16;

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
  // While everything else is considered the session spec.
  struct UsageTrackers {
    UsageTracker fee;
    // (target) => transfer value tracker
    mapping(address => UsageTracker) transferValue;
    // (target, selector) => call value tracker
    mapping(address => mapping(bytes4 => UsageTracker)) callValue;
    // (target, selector, index) => call parameter tracker
    // index is the constraint index in callPolicy, not the parameter index
    mapping(address => mapping(bytes4 => mapping(uint256 => UsageTracker))) params;
  }

  // This is the main struct that holds information about all sessions and their state.
  // This struct has weird layout because of the AA storage access restrictions for validation.
  // Innermost mappings are all mapping(address account => ...) because of this.
  struct SessionStorage {
    // (target, selector) => call policy
    mapping(address => mapping(bytes4 => mapping(address => CallPolicy))) callPolicy;
    // (target) => transfer policy. Used for calls with calldata.length < 4.
    mapping(address => mapping(address => TransferPolicy)) transferPolicy;
    mapping(address => Status) status;
    // Timestamp after which session is considered expired
    mapping(address => uint256) expiry;
    // Tracks gasLimit * maxFeePerGas of each transaction
    mapping(address => UsageLimit) feeLimit;
    UsageTrackers trackers;
    // These 2 mappings are only used in getters / view functions, not used during validation.
    mapping(address => CallTarget[]) callTargets;
    mapping(address => address[]) transferTargets;
  }

  struct CallPolicy {
    // this flag is needed, as otherwise, an empty CallPolicy (default mapping entry)
    // would mean no constraints
    bool isAllowed;
    uint256 maxValuePerUse;
    UsageLimit valueLimit;
    // We restrain from using a dynamic array here, as it would mean further
    // complications for the storage layout due to the AA storage access restrictions.
    uint256 totalConstraints;
    Constraint[MAX_CONSTRAINTS] constraints;
  }

  // For transfers, i.e. calls without a selector
  struct TransferPolicy {
    bool isAllowed;
    uint256 maxValuePerUse;
    UsageLimit valueLimit;
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

  struct CallTarget {
    address target;
    bytes4 selector;
  }

  struct SessionSpec {
    address signer;
    uint256 expiry;
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
    uint256 fee;
    LimitState[] transferValue;
    LimitState[] callValue;
    LimitState[] callParams;
  }

  function checkAndUpdate(UsageLimit storage limit, UsageTracker storage tracker, uint256 value) internal {
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

  function checkAndUpdate(Constraint storage constraint, UsageTracker storage tracker, bytes calldata data) internal {
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

  function validate(SessionStorage storage session, Transaction calldata transaction) internal {
    require(session.status[msg.sender] == Status.Active, "Session is not active");

    // TODO uncomment when it's possible to check timestamps during validation
    // require(block.timestamp <= session.expiry);

    // TODO: update fee allowance with the gasleft/refund at the end of execution
    uint256 fee = transaction.maxFeePerGas * transaction.gasLimit;
    session.feeLimit[msg.sender].checkAndUpdate(session.trackers.fee, fee);

    address target = address(uint160(transaction.to));

    if (transaction.data.length >= 4) {
      bytes4 selector = bytes4(transaction.data[:4]);
      CallPolicy storage callPolicy = session.callPolicy[target][selector][msg.sender];

      require(callPolicy.isAllowed, "Call not allowed");
      require(transaction.value <= callPolicy.maxValuePerUse, "Value exceeds limit");
      callPolicy.valueLimit.checkAndUpdate(session.trackers.callValue[target][selector], transaction.value);

      for (uint256 i = 0; i < callPolicy.totalConstraints; i++) {
        callPolicy.constraints[i].checkAndUpdate(session.trackers.params[target][selector][i], transaction.data);
      }
    } else {
      TransferPolicy storage transferPolicy = session.transferPolicy[target][msg.sender];
      require(transferPolicy.isAllowed, "Transfer not allowed");
      require(transaction.value <= transferPolicy.maxValuePerUse, "Value exceeds limit");
      transferPolicy.valueLimit.checkAndUpdate(session.trackers.transferValue[target], transaction.value);
    }
  }

  function fill(SessionStorage storage session, SessionSpec memory newSession, address account) internal {
    session.status[account] = Status.Active;
    session.expiry[account] = newSession.expiry;
    session.feeLimit[account] = newSession.feeLimit;
    for (uint256 i = 0; i < newSession.callPolicies.length; i++) {
      CallSpec memory newPolicy = newSession.callPolicies[i];
      session.callTargets[account].push(CallTarget({ target: newPolicy.target, selector: newPolicy.selector }));
      CallPolicy storage callPolicy = session.callPolicy[newPolicy.target][newPolicy.selector][account];
      callPolicy.isAllowed = true;
      callPolicy.maxValuePerUse = newPolicy.maxValuePerUse;
      callPolicy.valueLimit = newPolicy.valueLimit;
      require(newPolicy.constraints.length <= MAX_CONSTRAINTS, "Too many constraints");
      callPolicy.totalConstraints = newPolicy.constraints.length;
      for (uint256 j = 0; j < newPolicy.constraints.length; j++) {
        callPolicy.constraints[j] = newPolicy.constraints[j];
      }
    }
    for (uint256 i = 0; i < newSession.transferPolicies.length; i++) {
      TransferSpec memory newPolicy = newSession.transferPolicies[i];
      session.transferTargets[account].push(newPolicy.target);
      TransferPolicy storage transferPolicy = session.transferPolicy[newPolicy.target][account];
      transferPolicy.isAllowed = true;
      transferPolicy.maxValuePerUse = newPolicy.maxValuePerUse;
      transferPolicy.valueLimit = newPolicy.valueLimit;
    }
  }

  function getSpec(SessionStorage storage session, address account) internal view returns (SessionSpec memory) {
    CallSpec[] memory callPolicies = new CallSpec[](session.callTargets[account].length);
    TransferSpec[] memory transferPolicies = new TransferSpec[](session.transferTargets[account].length);
    for (uint256 i = 0; i < session.callTargets[account].length; i++) {
      CallTarget memory target = session.callTargets[account][i];
      CallPolicy storage callPolicy = session.callPolicy[target.target][target.selector][account];
      Constraint[] memory constraints = new Constraint[](callPolicy.totalConstraints);
      for (uint256 j = 0; j < callPolicy.totalConstraints; j++) {
        constraints[j] = callPolicy.constraints[j];
      }
      callPolicies[i] = CallSpec({
        target: target.target,
        selector: target.selector,
        maxValuePerUse: callPolicy.maxValuePerUse,
        valueLimit: callPolicy.valueLimit,
        constraints: constraints
      });
    }
    for (uint256 i = 0; i < session.transferTargets[account].length; i++) {
      address target = session.transferTargets[account][i];
      TransferPolicy storage transferPolicy = session.transferPolicy[target][account];
      transferPolicies[i] = TransferSpec({
        target: target,
        maxValuePerUse: transferPolicy.maxValuePerUse,
        valueLimit: transferPolicy.valueLimit
      });
    }
    return
      SessionSpec({
        // Signer addresses are not stored in SessionStorage,
        // and are filled in later in the `sessionSpec()` getter.
        signer: address(0),
        expiry: session.expiry[account],
        feeLimit: session.feeLimit[account],
        callPolicies: callPolicies,
        transferPolicies: transferPolicies
      });
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
      uint256 period = block.timestamp / limit.period;
      return limit.limit - tracker.allowanceUsage[period][account];
    }
  }

  function getState(SessionStorage storage session, address account) internal view returns (SessionState memory) {
    SessionSpec memory spec = getSpec(session, account);

    LimitState[] memory transferValue = new LimitState[](spec.transferPolicies.length);
    LimitState[] memory callValue = new LimitState[](spec.callPolicies.length);
    LimitState[] memory callParams = new LimitState[](MAX_CONSTRAINTS * spec.callPolicies.length); // there will be empty ones at the end
    uint256 paramLimitIndex = 0;

    for (uint256 i = 0; i < transferValue.length; i++) {
      TransferSpec memory transferSpec = spec.transferPolicies[i];
      transferValue[i] = LimitState({
        remaining: remainingLimit(
          transferSpec.valueLimit,
          session.trackers.transferValue[transferSpec.target],
          account
        ),
        target: spec.transferPolicies[i].target,
        selector: bytes4(0),
        index: 0
      });
    }

    for (uint256 i = 0; i < callValue.length; i++) {
      CallSpec memory callSpec = spec.callPolicies[i];
      callValue[i] = LimitState({
        remaining: remainingLimit(
          callSpec.valueLimit,
          session.trackers.callValue[callSpec.target][callSpec.selector],
          account
        ),
        target: callSpec.target,
        selector: callSpec.selector,
        index: 0
      });

      for (uint256 j = 0; j < callSpec.constraints.length; j++) {
        if (callSpec.constraints[j].limit.limitType != LimitType.Unlimited) {
          callParams[paramLimitIndex++] = LimitState({
            remaining: remainingLimit(
              callSpec.constraints[j].limit,
              session.trackers.params[callSpec.target][callSpec.selector][j],
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
        fee: remainingLimit(spec.feeLimit, session.trackers.fee, account),
        transferValue: transferValue,
        callValue: callValue,
        callParams: callParams
      });
  }
}

contract SessionKeyValidator is IHook, IValidationHook, IModuleValidator, IModule {
  using SessionLib for SessionLib.SessionStorage;
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes4 constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;

  // session owner => session storage
  mapping(address => SessionLib.SessionStorage) private sessions;
  // account => owners
  mapping(address => EnumerableSet.AddressSet) sessionOwners;

  function sessionSpec(address account, address signer) public view returns (SessionLib.SessionSpec memory spec) {
    spec = sessions[signer].getSpec(account);
    spec.signer = signer;
  }

  function sessionState(address account, address signer) public view returns (SessionLib.SessionState memory) {
    return sessions[signer].getState(account);
  }

  function activeSigners(address account) external view returns (address[] memory) {
    return sessionOwners[account].values();
  }

  function sessionList(
    address account
  ) external view returns (SessionLib.SessionState[] memory states, SessionLib.SessionSpec[] memory specs) {
    uint256 length = sessionOwners[account].length();
    states = new SessionLib.SessionState[](length);
    specs = new SessionLib.SessionSpec[](length);
    for (uint256 i = 0; i < length; i++) {
      address signer = sessionOwners[account].at(i);
      specs[i] = sessionSpec(account, signer);
      states[i] = sessionState(account, signer);
    }
  }

  function handleValidation(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    // this only validates that the session key is linked to the account, not the transaction against the session spec
    return isValidSignature(signedHash, signature) == EIP1271_SUCCESS_RETURN_VALUE;
  }

  function addValidationKey(bytes memory sessionData) external returns (bool) {
    if (sessionData.length == 0) {
      return false;
    }
    SessionLib.SessionSpec memory newSession = abi.decode(sessionData, (SessionLib.SessionSpec));
    createSession(newSession);
    return true;
  }

  function createSession(SessionLib.SessionSpec memory newSession) public {
    require(_isInitialized(msg.sender), "Account not initialized");
    require(newSession.signer != address(0), "Invalid signer");
    require(
      sessions[newSession.signer].status[msg.sender] == SessionLib.Status.NotInitialized,
      "Session already exists"
    );
    require(newSession.feeLimit.limitType != SessionLib.LimitType.Unlimited, "Unlimited fee allowance is not safe");
    sessionOwners[msg.sender].add(newSession.signer);
    sessions[newSession.signer].fill(newSession, msg.sender);
  }

  function init(bytes calldata data) external {
    // to prevent recursion, since addHook also calls init
    if (!_isInitialized(msg.sender)) {
      IValidatorManager(msg.sender).addModuleValidator(address(this), data);
      IHookManager(msg.sender).addHook(abi.encodePacked(address(this)), true);
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
    require(sessionOwners[msg.sender].length() == 0, "Revoke all keys first");
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
  function revokeKey(address sessionOwner) public {
    require(sessions[sessionOwner].status[msg.sender] == SessionLib.Status.Active, "Nothing to revoke");
    sessions[sessionOwner].status[msg.sender] = SessionLib.Status.Closed;
    sessionOwners[msg.sender].remove(sessionOwner);
  }

  function revokeKeys(address[] calldata owners) external {
    for (uint256 i = 0; i < owners.length; i++) {
      revokeKey(owners[i]);
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
    (address recoveredAddress, ) = ECDSA.tryRecover(hash, signature);
    SessionLib.Status status = sessions[recoveredAddress].status[msg.sender];
    if (status != SessionLib.Status.Active) {
      magic = bytes4(0);
    }
  }

  function validationHook(bytes32 signedHash, Transaction calldata transaction, bytes calldata _hookData) external {
    (bytes memory signature, address validator, ) = abi.decode(transaction.signature, (bytes, address, bytes[]));
    if (validator != address(this)) {
      // This transaction is not meant to be validated by this module
      return;
    }
    (address recoveredAddress, ) = ECDSA.tryRecover(signedHash, signature);
    require(recoveredAddress != address(0), "Invalid signer");
    sessions[recoveredAddress].validate(transaction);
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
