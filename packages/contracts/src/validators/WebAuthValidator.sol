// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import "./PasskeyValidator.sol";

// import "hardhat/console.sol";

/**
 * @title validator contract for passkey r1 signatures
 * @author https://getclave.io
 */
contract WebAuthValidator is PasskeyValidator, IModuleValidator {
  struct AttestationPasskey {
    bytes32[2] passkey;
    string originDomain;
  }

  mapping(address => AttestationPasskey[]) accountAddressToKeys;

  function addValidationKey(bytes memory key) external returns (bool) {
    (bytes32[2] memory key32, string memory originDomain) = abi.decode(key, (bytes32[2], string));
    accountAddressToKeys[msg.sender].push(AttestationPasskey({ passkey: key32, originDomain: originDomain }));

    return true;
  }

  function handleValidation(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    AttestationPasskey[] memory validationKeys = accountAddressToKeys[msg.sender];

    for (uint256 validationKeyIndex = 0; validationKeyIndex < validationKeys.length; validationKeyIndex++) {
      // Printing this hash makes capturing this for a replay test easier
      // console.log("signed hash");
      // console.logBytes32(signedHash);
      AttestationPasskey memory attestationPasskey = validationKeys[validationKeyIndex];

      bool _success = webAuthVerify(signedHash, signature, attestationPasskey);

      if (_success) {
        return true;
      }
    }

    return false;
  }

  function webAuthVerify(
    bytes32 transactionHash,
    bytes memory fatSignature,
    AttestationPasskey memory attestationPasskey
  ) internal view returns (bool valid) {
    (bytes memory authenticatorData, string memory clientDataJSON, bytes32[2] memory rs) = _decodeFatSignature(
      fatSignature
    );

    // console.log("clientDataJSON");
    // console.logString(clientDataJSON);
    // malleability check
    if (rs[1] > lowSmax) {
      // console.log("malleability check failed");
      return false;
    }

    // check if the flags are set
    if (authenticatorData[32] & AUTH_DATA_MASK != AUTH_DATA_MASK) {
      // console.log("auth data mask failed");
      return false;
    }

    // parse out the important fields (type, challenge, and origin): https://goo.gl/yabPex
    // TODO: test if the parse fails for more than 10 elements, otherwise can have a malicious header
    (uint returnValue, JsmnSolLib.Token[] memory tokens, uint actualNum) = JsmnSolLib.parse(clientDataJSON, 20);
    if (returnValue != 0) {
      // console.log("failed to parse json");
      // console.logUint(returnValue);
      return false;
    }

    bytes32[2] memory pubKey = attestationPasskey.passkey;

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
            // console.log("duplicate challenge, bad json!");
            return false;
          }
          // this is the key part to ensure the signature is for the provided transaction
          bytes memory challengeDataArray = Base64.decode(challengeValue);
          if (challengeDataArray.length != 32) {
            // wrong hash size
            // console.log("invalid hash data length in json challenge field");
            return false;
          }
          bytes32 challengeData = abi.decode(challengeDataArray, (bytes32));

          validChallenge = challengeData == transactionHash;
          // console.log("validChallenge");
          // console.logBool(validChallenge);
        } else if (Strings.equal(keyOrValue, "type")) {
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory typeValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (validType) {
            // console.log("duplicate type field, bad json");
            return false;
          }
          validType = Strings.equal("webauthn.get", typeValue);
          // console.log("valid type");
          // console.logBool(validType);
        } else if (Strings.equal(keyOrValue, "origin")) {
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory originValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (validOrigin) {
            // console.log("duplicate origin field, bad json");
            return false;
          }
          // console.logString(attestationPasskey.originDomain);
          validOrigin = Strings.equal(attestationPasskey.originDomain, originValue);
          // console.log("valid origin");
          // console.logBool(validOrigin);
        }
        // TODO: check 'cross-origin' keys as part of signature
      }
    }

    if (!validChallenge || !validType) {
      // console.log("invalid challenge or type");
      return false;
    }

    bytes32 message = _createMessage(authenticatorData, bytes(clientDataJSON));
    valid = callVerifier(P256_VERIFIER, message, rs, pubKey);
  }
}
