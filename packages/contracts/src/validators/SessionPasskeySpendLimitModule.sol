// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IERC7579Module.sol";

import { IModule } from "../interfaces/IModule.sol";

import { IERC7579Module } from "../interfaces/IERC7579Module.sol";
import { IR1Validator } from "../interfaces/IValidator.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";

// import "hardhat/console.sol";

/**
 * Looking to combine with the validator to ensure that the spend limit is touched
 * Working on using the 7579 module + zksync validator
 * Flow is create passkey with optional spend-limit (as a validator)
 * have that passkey create a time & spend limited session key,
 * then reject transactions (as a validator) when the session key expires.
 */
contract SessionPasskeySpendLimitModule is IERC7579Module, IModule, IModuleValidator {
  bytes4 constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;

  struct TokenSpendLimit {
    uint256 limit;
    // timestamp per transfer
    mapping(uint256 timeperiod => uint256) spent;
  }

  struct SessionData {
    // account address that is getting spend-limited
    address accountAddress;
    // block timestamp
    uint256 expiresAt;
    // token spend limit is per session
    mapping(address tokenAddress => TokenSpendLimit spendLimit) spendLimitByToken;
  }

  // 2-way lookup between session and token-spend-limits, need to be kept in sync
  mapping(address sessionAccount => SessionData limitedAccount) spendLimitBySession;
  mapping(address limitedAccount => address[] sessionAccount) sessionsByAccount;

  struct SpendLimit {
    // ERC-20 address
    address tokenAddress;
    uint256 limit;
  }

  // this is used to create/manage sessions/limits, but not for storage
  struct SessionKey {
    // the public address of the session
    address sessionKey;
    // block timestamp
    uint256 expiresAt;
    // if not de-duplicated, the last token address wins
    SpendLimit[] spendLimits;
  }

  function handleValidation(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    // this only validates that the session key is linked to the account, not the spend limit
    return isValidSignature(signedHash, signature) == EIP1271_SUCCESS_RETURN_VALUE;
  }

  // expects SessionKey[]
  function addValidationKey(bytes memory installData) external returns (bool) {
    // console.log("installing session-key spend-limit module");
    SessionKey[] memory sessionKeys = abi.decode(installData, (SessionKey[]));
    for (uint256 sessionKeyIndex = 0; sessionKeyIndex < sessionKeys.length; sessionKeyIndex++) {
      setSessionKey(sessionKeys[sessionKeyIndex]);
    }
    return false;
  }

  function init(bytes calldata initData) external {
    _install(initData);
  }

  /* array of token spend limit configurations (sane defaults)
   * @param data TokenConfig[]
   */
  function onInstall(bytes calldata data) external override {
    _install(data);
  }

  function _install(bytes calldata installData) internal {
    // console.log("installing session-key spend-limit module");
    SessionKey[] memory sessionKeys = abi.decode(installData, (SessionKey[]));
    for (uint256 sessionKeyIndex = 0; sessionKeyIndex < sessionKeys.length; sessionKeyIndex++) {
      setSessionKey(sessionKeys[sessionKeyIndex]);
    }
  }

  /* Remove all the spending limits for the message sender
   * @param data (unused, but needed to satisfy interfaces)
   */
  function onUninstall(bytes calldata) external override {
    _clearSender();
  }

  function disable() external {
    _clearSender();
  }

  function _clearSender() internal {
    // FIXME: spend limits are orphaned without a reverse token mapping
    // delete spendLimitByAccount[msg.sender];

    uint256 sessionLength = sessionsByAccount[msg.sender].length;
    for (uint256 index = 0; index < sessionLength; index++) {
      delete spendLimitBySession[sessionsByAccount[msg.sender][index]];
      delete sessionsByAccount[msg.sender][index];
    }
  }

  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    // found by example
    return interfaceId == 0x01ffc9a7 || interfaceId == 0xffffffff;
  }

  function setSessionKey(SessionKey memory sessionKey) internal {
    SessionData storage sessionData = spendLimitBySession[sessionKey.sessionKey];
    if (sessionData.accountAddress == address(0)) {
      sessionData.accountAddress = msg.sender;
    } else {
      require(sessionData.accountAddress == msg.sender, "Session key is already assigned to another account");
    }
    sessionData.expiresAt = sessionKey.expiresAt;

    for (uint256 spendLimitIndex = 0; spendLimitIndex < sessionKey.spendLimits.length; spendLimitIndex++) {
      SpendLimit memory initSpendLimit = sessionKey.spendLimits[spendLimitIndex];

      TokenSpendLimit storage initTokenSpendLimit = sessionData.spendLimitByToken[initSpendLimit.tokenAddress];
      require(initSpendLimit.limit >= 0, "Spend limit must be set, cannot be 0");
      initTokenSpendLimit.limit = initSpendLimit.limit;
    }
  }

  /*
   * Update spend limit of sender for provided tokens in list
   * @param configs TokenConfig[] to update
   */
  function setSessionKeys(SessionKey[] calldata sessionKeys) external {
    for (uint256 sessionKeyIndex = 0; sessionKeyIndex < sessionKeys.length; sessionKeyIndex++) {
      setSessionKey(sessionKeys[sessionKeyIndex]);
    }
  }

  function revokeSession(address sessionKey) external {
    SessionData storage sessionToRemove = spendLimitBySession[sessionKey];
    require(sessionToRemove.accountAddress == msg.sender, "cannot remove session for another account");
    // this doesn't clear the spend limits if the session is re-added
    delete spendLimitBySession[sessionKey];

    uint256 sessionLength = sessionsByAccount[msg.sender].length;
    for (uint256 index = 0; index < sessionLength; index++) {
      if (sessionsByAccount[msg.sender][index] == sessionKey) {
        delete sessionsByAccount[msg.sender][index];
      }
    }
  }

  /*
   * If there are any spend limits configured
   * @param smartAccount The smart account to check
   * @return true if spend limits are configured initialized, false otherwise
   */
  function isInitialized(address smartAccount) external view returns (bool) {
    return sessionsByAccount[smartAccount].length > 0;
  }

  /*
   * Currently doing 1271 validation, but might update the interface to match the zksync account validation
   */
  function isValidSignature(bytes32 _hash, bytes memory _signature) public view returns (bytes4 magic) {
    magic = EIP1271_SUCCESS_RETURN_VALUE;

    if (_signature.length != 65) {
      // Signature is invalid anyway, but we need to proceed with the signature verification as usual
      // in order for the fee estimation to work correctly
      _signature = new bytes(65);

      // Making sure that the signatures look like a valid ECDSA signature and are not rejected rightaway
      // while skipping the main verification process.
      _signature[64] = bytes1(uint8(27));
    }

    // extract ECDSA signature
    uint8 v;
    bytes32 r;
    bytes32 s;
    // Signature loading code
    // we jump 32 (0x20) as the first slot of bytes contains the length
    // we jump 65 (0x41) per signature
    // for v we load 32 bytes ending with v (the first 31 come from s) then apply a mask
    assembly {
      r := mload(add(_signature, 0x20))
      s := mload(add(_signature, 0x40))
      v := and(mload(add(_signature, 0x41)), 0xff)
    }

    if (v != 27 && v != 28) {
      magic = bytes4(0);
      // console.log("session key signature v is invalid(27 or 28)");
    }

    // EIP-2 still allows signature malleability for ecrecover(). Remove this possibility and make the signature
    // unique. Appendix F in the Ethereum Yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf), defines
    // the valid range for s in (301): 0 < s < secp256k1n ÷ 2 + 1, and for v in (302): v ∈ {27, 28}. Most
    // signatures from current libraries generate a unique signature with an s-value in the lower half order.
    //
    // If your library generates malleable signatures, such as s-values in the upper range, calculate a new s-value
    // with 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - s1 and flip v from 27 to 28 or
    // vice versa. If your library also generates signatures with 0/1 for v instead 27/28, add 27 to v to accept
    // these malleable signatures as well.
    if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
      magic = bytes4(0);
      // console.log("session key signature s is too high");
    }

    address recoveredAddress = ecrecover(_hash, v, r, s);
    // console.log("recoveredAddress(sessionKey)");
    // console.logAddress(recoveredAddress);

    SessionData storage sessionData = spendLimitBySession[recoveredAddress];
    // console.log("sessionData.accountAddress");
    // console.logAddress(sessionData.accountAddress);
    // console.log("msg.sender");
    // console.logAddress(msg.sender);
    if (sessionData.accountAddress != msg.sender || recoveredAddress == address(0)) {
      // Note, that we should abstain from using the require here in order to allow for fee estimation to work
      magic = bytes4(0);
      // console.log("invalid session key");
    }
  }

  /**
   * @dev Getting the target and session key together is the trick here.
   * For ERC20 transfers, compare the token contract address (target)
   * with any spend limits configured for the account.
   * Revert if the spend-limit has been exceeded
   */
  function _checkSpendingLimit(address target, address sessionKey, bytes calldata callData) internal {
    SessionData storage accountSessionData = spendLimitBySession[sessionKey];
    TokenSpendLimit storage spendLimit = accountSessionData.spendLimitByToken[target];
    uint256 timeperiod = block.timestamp / 1 weeks;
    (, uint256 value) = abi.decode(callData[4:], (address, uint256));
    if (spendLimit.spent[timeperiod] + value > spendLimit.limit) {
      revert("SpendingLimitHook: spending limit exceeded");
    } else {
      spendLimit.spent[timeperiod] += value;
    }
  }

  // check the spending limit of the target for the transaction
  function onExecute(
    address account,
    address msgSender,
    address target,
    uint256 value,
    bytes calldata callData
  ) internal virtual returns (bytes memory hookData) {}

  /**
   * The name of the module
   * @return name The name of the module
   */
  function name() external pure returns (string memory) {
    return "SessionPasskeySpendLimitModule";
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
   * CALLDATA DECODING - this needs to check 2 things:
   * 1. Does this transaction contain an ERC20 transfer?
   * 2. What is the token contract address for this transfer
   * @return address the token contract for the transfer, otherwise 0
   */
  function _preCheckParsing(
    address msgSender,
    uint256 msgValue,
    bytes calldata msgData
  ) internal returns (address tokenAddress) {
    require(
      bytes4(msgData[2:10]) == IERC20.transfer.selector || bytes4(msgData[2:10]) == IERC20.transferFrom.selector,
      "Must perform ERC20 transfer"
    );
    // XXX: not sure if the offsets here are correct given that this is being used with a smart account
    tokenAddress = address(bytes20(msgData[16:35]));
  }

  /**
   * Get the sender of the transaction
   *
   * @return account the sender of the transaction
   */
  function _getAccount() internal view returns (address account) {
    account = msg.sender;
    address _account;
    address forwarder;
    if (msg.data.length >= 40) {
      assembly {
        _account := shr(96, calldataload(sub(calldatasize(), 20)))
        forwarder := shr(96, calldataload(sub(calldatasize(), 40)))
      }
      if (forwarder == msg.sender) {
        account = _account;
      }
    }
  }

  /*
   * Look at the transaction data to parse out what needs to be done
   */
  function preCheck(
    address msgSender,
    uint256 msgValue,
    bytes calldata msgData
  ) external returns (bytes memory hookData) {
    address target = _preCheckParsing(msgSender, msgValue, msgData);
    // TODO: how can the hook get the signing key from just the transaction data
    // (can you recover it again from the signature if that's part of the msgData?)
    address sessionKey = address(0);
    _checkSpendingLimit(target, sessionKey, msgData);
  }

  /*
   * Validate data from the pre-check hook after the transaction is executed
   */
  function postCheck(bytes calldata hookData) external {}

  // Returns all registered session keys.
  function getSessionKeys() external view returns (address[] memory) {
    return sessionsByAccount[msg.sender];
  }

  // Returns session key data for the given session public key.
  function getSessionKeyData(address sessionPublicKey) external view returns (SessionKey memory sessionKey) {
    SessionData storage sessionAccountData = spendLimitBySession[sessionPublicKey];
    sessionKey.expiresAt = sessionAccountData.expiresAt;
    sessionKey.sessionKey = sessionAccountData.accountAddress;
    // TODO: also return configured token spend limits
  }

  // Returns the remaining spend limit for a specific token under the session key (total - used).
  function getRemainingSpendLimit(address sessionPublicKey, address token) external view returns (uint256) {
    SessionData storage accountSessionData = spendLimitBySession[sessionPublicKey];
    TokenSpendLimit storage spendLimit = accountSessionData.spendLimitByToken[token];
    uint256 timeperiod = block.timestamp / 1 weeks;
    // XXX: This range index appears incorrect
    return spendLimit.limit - spendLimit.spent[timeperiod];
  }
}
