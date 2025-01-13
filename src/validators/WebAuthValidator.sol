// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import { IModule } from "../interfaces/IModule.sol";
import { VerifierCaller } from "../helpers/VerifierCaller.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64 } from "solady/src/utils/Base64.sol";
import { JSONParserLib } from "solady/src/utils/JSONParserLib.sol";

/// @title WebAuthValidator
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev This contract allows secure user authentication using WebAuthn public keys.
contract WebAuthValidator is VerifierCaller, IModuleValidator {
  using JSONParserLib for JSONParserLib.Item;
  using JSONParserLib for string;

  address private constant P256_VERIFIER = address(0x100);
  bytes1 private constant AUTH_DATA_MASK = 0x05;
  bytes32 private constant LOW_S_MAX = 0x7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8;
  bytes32 private constant HIGH_R_MAX = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551;

  event PasskeyCreated(address indexed keyOwner, string originDomain);

  // The layout is weird due to EIP-7562 storage read restrictions for validation phase.
  mapping(string originDomain => mapping(address accountAddress => bytes32)) public lowerKeyHalf;
  mapping(string originDomain => mapping(address accountAddress => bytes32)) public upperKeyHalf;

  function onInstall(bytes calldata data) external override {
    if (data.length > 0) {
      require(_addValidationKey(data), "WebAuthValidator: key already exists");
    }
  }

  function onUninstall(bytes calldata data) external override {
    string[] memory domains = abi.decode(data, (string[]));
    for (uint256 i = 0; i < domains.length; i++) {
      string memory domain = domains[i];
      lowerKeyHalf[domain][msg.sender] = 0x0;
      upperKeyHalf[domain][msg.sender] = 0x0;
    }
  }

  function addValidationKey(bytes calldata key) external returns (bool) {
    return _addValidationKey(key);
  }

  function _addValidationKey(bytes calldata key) internal returns (bool) {
    (bytes32[2] memory key32, string memory originDomain) = abi.decode(key, (bytes32[2], string));
    bytes32 initialLowerHalf = lowerKeyHalf[originDomain][msg.sender];
    bytes32 initialUpperHalf = upperKeyHalf[originDomain][msg.sender];

    // we might want to support multiple passkeys per domain
    lowerKeyHalf[originDomain][msg.sender] = key32[0];
    upperKeyHalf[originDomain][msg.sender] = key32[1];

    // we're returning true if this was a new key, false for update
    bool keyExists = initialLowerHalf == 0 && initialUpperHalf == 0;

    emit PasskeyCreated(msg.sender, originDomain);

    return keyExists;
  }

  function validateSignature(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    return webAuthVerify(signedHash, signature);
  }

  function validateTransaction(
    bytes32 signedHash,
    bytes calldata signature,
    Transaction calldata
  ) external view returns (bool) {
    return webAuthVerify(signedHash, signature);
  }

  function webAuthVerify(bytes32 transactionHash, bytes memory fatSignature) internal view returns (bool) {
    (bytes memory authenticatorData, string memory clientDataJSON, bytes32[2] memory rs) = _decodeFatSignature(
      fatSignature
    );

    if (rs[0] <= 0 || rs[0] > HIGH_R_MAX || rs[1] <= 0 || rs[1] > LOW_S_MAX) {
      return false;
    }

    // check if the flags are set
    if (authenticatorData[32] & AUTH_DATA_MASK != AUTH_DATA_MASK) {
      return false;
    }

    // parse out the important fields (type, challenge, origin, crossOrigin): https://goo.gl/yabPex
    JSONParserLib.Item memory root = JSONParserLib.parse(clientDataJSON);
    string memory challenge = root.at('"challenge"').value().decodeString();
    bytes memory challengeData = Base64.decode(challenge);
    if (challengeData.length != 32) {
      return false; // wrong hash size
    }
    if (bytes32(challengeData) != transactionHash) {
      return false;
    }

    string memory type_ = root.at('"type"').value().decodeString();
    if (!Strings.equal("webauthn.get", type_)) {
      return false;
    }

    string memory origin = root.at('"origin"').value().decodeString();
    bytes32[2] memory pubkey;
    pubkey[0] = lowerKeyHalf[origin][msg.sender];
    pubkey[1] = upperKeyHalf[origin][msg.sender];
    // This really only validates the origin is set
    if (pubkey[0] == 0 || pubkey[1] == 0) {
      return false;
    }

    JSONParserLib.Item memory crossOriginItem = root.at('"crossOrigin"');
    if (!crossOriginItem.isUndefined()) {
      string memory crossOrigin = crossOriginItem.value();
      if (!Strings.equal("false", crossOrigin)) {
        return false;
      }
    }

    bytes32 message = _createMessage(authenticatorData, bytes(clientDataJSON));
    return callVerifier(P256_VERIFIER, message, rs, pubkey);
  }

  function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
    return
      interfaceId == type(IERC165).interfaceId ||
      interfaceId == type(IModuleValidator).interfaceId ||
      interfaceId == type(IModule).interfaceId;
  }

  function _createMessage(
    bytes memory authenticatorData,
    bytes memory clientData
  ) private pure returns (bytes32 message) {
    bytes32 clientDataHash = sha256(clientData);
    message = sha256(bytes.concat(authenticatorData, clientDataHash));
  }

  function _decodeFatSignature(
    bytes memory fatSignature
  ) private pure returns (bytes memory authenticatorData, string memory clientDataSuffix, bytes32[2] memory rs) {
    (authenticatorData, clientDataSuffix, rs) = abi.decode(fatSignature, (bytes, string, bytes32[2]));
  }

  function rawVerify(
    bytes32 message,
    bytes32[2] calldata rs,
    bytes32[2] calldata pubKey
  ) external view returns (bool valid) {
    valid = callVerifier(P256_VERIFIER, message, rs, pubKey);
  }
}
