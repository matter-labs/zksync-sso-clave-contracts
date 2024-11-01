// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import "./PasskeyValidator.sol";

import "../helpers/Logger.sol";

/**
 * @title validator contract for passkey r1 signatures
 * @author https://getclave.io
 */
contract WebAuthValidator is PasskeyValidator, IModuleValidator {
  // The layout is weird due to EIP-7562 storage read restrictions for validation phase.
  mapping(string originDomain => mapping(address accountAddress => bytes32)) public lowerKeyHalf;
  mapping(string originDomain => mapping(address accountAddress => bytes32)) public upperKeyHalf;

  function addValidationKey(bytes memory key) external returns (bool) {
    (bytes32[2] memory key32, string memory originDomain) = abi.decode(key, (bytes32[2], string));
    bytes32 initialLowerHalf = lowerKeyHalf[originDomain][msg.sender];
    bytes32 initialUpperHalf = upperKeyHalf[originDomain][msg.sender];

    // we might want to support multiple passkeys per domain
    lowerKeyHalf[originDomain][msg.sender] = key32[0];
    upperKeyHalf[originDomain][msg.sender] = key32[1];

    // we're returning true if this was a new key, false for update
    return initialLowerHalf == 0 && initialUpperHalf == 0;
  }

  function handleValidation(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    // Printing this hash makes capturing this for a replay test easier
    Logger.logString("signed hash");
    Logger.logBytes32(signedHash);

    return webAuthVerify(signedHash, signature);
  }

  function webAuthVerify(bytes32 transactionHash, bytes memory fatSignature) internal view returns (bool valid) {
    (bytes memory authenticatorData, string memory clientDataJSON, bytes32[2] memory rs) = _decodeFatSignature(
      fatSignature
    );

    if (rs[1] > lowSmax) {
      Logger.logString("malleability check failed");
      return false;
    }

    // check if the flags are set
    if (authenticatorData[32] & AUTH_DATA_MASK != AUTH_DATA_MASK) {
      Logger.logString("auth data mask failed");
      return false;
    }

    // parse out the important fields (type, challenge, and origin): https://goo.gl/yabPex
    // TODO: test if the parse fails for more than 10 elements, otherwise can have a malicious header
    (uint returnValue, JsmnSolLib.Token[] memory tokens, uint actualNum) = JsmnSolLib.parse(clientDataJSON, 20);
    if (returnValue != 0) {
      Logger.logString("failed to parse json");
      Logger.logUint(returnValue);
      return false;
    }

    bytes32[2] memory pubKey;

    // look for fields by name, then compare to expected values
    bool validChallenge = false;
    bool validType = false;
    bool validOrigin = false;
    for (uint256 index = 1; index < actualNum; index++) {
      JsmnSolLib.Token memory t = tokens[index];
      if (t.jsmnType == JsmnSolLib.JsmnType.STRING) {
        string memory keyOrValue = JsmnSolLib.getBytes(clientDataJSON, t.start, t.end);
        if (Strings.equal(keyOrValue, "challenge")) {
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory challengeValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (validChallenge) {
            Logger.logString("duplicate challenge, bad json!");
            return false;
          }
          // this is the key part to ensure the signature is for the provided transaction
          bytes memory challengeDataArray = Base64.decode(challengeValue);
          if (challengeDataArray.length != 32) {
            // wrong hash size
            Logger.logString("invalid hash data length in json challenge field");
            return false;
          }
          bytes32 challengeData = abi.decode(challengeDataArray, (bytes32));

          validChallenge = challengeData == transactionHash;
          Logger.logString("validChallenge");
          Logger.logBool(validChallenge);
        } else if (Strings.equal(keyOrValue, "type")) {
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory typeValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (validType) {
            Logger.logString("duplicate type field, bad json");
            return false;
          }
          validType = Strings.equal("webauthn.get", typeValue);
          Logger.logString("valid type");
          Logger.logBool(validType);
        } else if (Strings.equal(keyOrValue, "origin")) {
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory originValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (validOrigin) {
            Logger.logString("duplicate origin field, bad json");
            return false;
          }
          pubKey[0] = lowerKeyHalf[originValue][msg.sender];
          pubKey[1] = upperKeyHalf[originValue][msg.sender];

          // This really only validates the origin is set
          validOrigin = pubKey[0] != 0 && pubKey[1] != 0;
        }
        // TODO: check 'cross-origin' keys as part of signature
      }
    }

    if (!validChallenge || !validType) {
      Logger.logString("invalid challenge or type");
      return false;
    }

    bytes32 message = _createMessage(authenticatorData, bytes(clientDataJSON));
    valid = callVerifier(P256_VERIFIER, message, rs, pubKey);
  }

  /// @inheritdoc IERC165
  function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
    return super.supportsInterface(interfaceId) || interfaceId == type(IModuleValidator).interfaceId;
  }
}
