// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { Base64 } from "../helpers/Base64.sol";
import { IR1Validator, IERC165 } from "../interfaces/IValidator.sol";
import { Errors } from "../libraries/Errors.sol";
import { VerifierCaller } from "../helpers/VerifierCaller.sol";
import { JsmnSolLib } from "../libraries/JsmnSolLib.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

import "hardhat/console.sol";

/**
 * @title validator contract for passkey r1 signatures
 * @author https://getclave.io
 */
contract PasskeyValidator is IR1Validator, VerifierCaller {
  address constant P256_VERIFIER = address(0x100);
  string constant ClIENT_DATA_PREFIX = '{"type":"webauthn.get","challenge":"';
  string constant IOS_ClIENT_DATA_SUFFIX = '","origin":"https://getclave.io"}';
  string constant ANDROID_ClIENT_DATA_SUFFIX =
    '","origin":"android:apk-key-hash:-sYXRdwJA3hvue3mKpYrOZ9zSPC7b4mbgzJmdZEDO5w","androidPackageName":"com.clave.mobile"}';
  // hash of 'https://getclave.io' + (BE, BS, UP, UV) flags set + unincremented sign counter
  bytes constant AUTHENTICATOR_DATA = hex"175faf8504c2cdd7c01778a8b0efd4874ecb3aefd7ebb7079a941f7be8897d411d00000000";
  // user presence and user verification flags
  bytes1 constant AUTH_DATA_MASK = 0x05;
  // maximum value for 's' in a secp256r1 signature
  bytes32 constant lowSmax = 0x7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8;

  /// @inheritdoc IR1Validator
  function validateSignature(
    bytes32 challenge,
    bytes calldata signature,
    bytes32[2] calldata pubKey
  ) external view returns (bool valid) {
    if (signature.length == 65) {
      valid = _validateSignature(challenge, signature, pubKey);
    } else {
      valid = _validateFatSignature(challenge, signature, pubKey);
    }
  }

  /// @inheritdoc IERC165
  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return interfaceId == type(IR1Validator).interfaceId || interfaceId == type(IERC165).interfaceId;
  }

  function _validateSignature(
    bytes32 challenge,
    bytes calldata signature,
    bytes32[2] calldata pubKey
  ) private view returns (bool valid) {
    bool isAndroid = signature[0] == 0x00;
    bytes32[2] memory rs = abi.decode(signature[1:], (bytes32[2]));

    // malleability check
    if (rs[1] > lowSmax) {
      return false;
    }

    bytes memory challengeBase64 = bytes(Base64.encodeURL(bytes.concat(challenge)));
    bytes memory clientData;
    if (isAndroid) {
      clientData = bytes.concat(bytes(ClIENT_DATA_PREFIX), challengeBase64, bytes(ANDROID_ClIENT_DATA_SUFFIX));
    } else {
      clientData = bytes.concat(bytes(ClIENT_DATA_PREFIX), challengeBase64, bytes(IOS_ClIENT_DATA_SUFFIX));
    }

    bytes32 message = _createMessage(AUTHENTICATOR_DATA, clientData);

    valid = callVerifier(P256_VERIFIER, message, rs, pubKey);
  }

  function _validateFatSignature(
    bytes32 challenge,
    bytes calldata fatSignature,
    bytes32[2] calldata pubKey
  ) private view returns (bool valid) {
    (bytes memory authenticatorData, string memory clientDataSuffix, bytes32[2] memory rs) = _decodeFatSignature(
      fatSignature
    );

    // malleability check
    if (rs[1] > lowSmax) {
      return false;
    }

    // check if the flags are set
    if (authenticatorData[32] & AUTH_DATA_MASK != AUTH_DATA_MASK) {
      return false;
    }

    bytes memory challengeBase64 = bytes(Base64.encodeURL(bytes.concat(challenge)));
    bytes memory clientData = bytes.concat(bytes(ClIENT_DATA_PREFIX), challengeBase64, bytes(clientDataSuffix));

    bytes32 message = _createMessage(authenticatorData, clientData);

    valid = callVerifier(P256_VERIFIER, message, rs, pubKey);
  }

  function webAuthVerify(
    bytes32 transactionHash,
    bytes calldata fatSignature,
    bytes32[2] calldata pubKey
  ) external view returns (bool valid) {
    (bytes memory authenticatorData, string memory clientDataJSON, bytes32[2] memory rs) = _decodeFatSignature(
      fatSignature
    );

    console.log("authenticatorData");
    console.logBytes(authenticatorData);
    console.log("clientDataJSON");
    console.logString(clientDataJSON);
    // malleability check
    if (rs[1] > lowSmax) {
      console.log("malleability check failed");
      return false;
    }

    // check if the flags are set
    if (authenticatorData[32] & AUTH_DATA_MASK != AUTH_DATA_MASK) {
      console.log("auth data mask failed");
      return false;
    }

    // parse out the important fields (type, challenge, and origin): https://goo.gl/yabPex
    // TODO: test if the parse fails for more than 10 elements, otherwise can have a malicious header
    (uint returnValue, JsmnSolLib.Token[] memory tokens, uint actualNum) = JsmnSolLib.parse(clientDataJSON, 20);
    if (returnValue != 0) {
      console.log("failed to parse json");
      console.logUint(returnValue);
      return false;
    }

    // look for fields by name, then compare to expected values
    bool validChallenge = false;
    bool validType = false;
    for (uint256 index = 1; index < actualNum; index++) {
      JsmnSolLib.Token memory t = tokens[index];
      if (t.jsmnType == JsmnSolLib.JsmnType.STRING) {
        string memory keyOrValue = JsmnSolLib.getBytes(clientDataJSON, t.start, t.end);
        if (Strings.equal(keyOrValue, "challenge")) {
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory challengeValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (validChallenge) {
            console.log("duplicate challange, bad json!");
            return false;
          }
          // this is the key part to ensure the signature is for the provided transaction
          bytes memory challengeDataArray = Base64.decode(challengeValue);
          if (challengeDataArray.length != 32) {
            // wrong hash size
            console.log("invalid hash data length in json challange field");
            return false;
          }
          bytes32 challengeData = abi.decode(challengeDataArray, (bytes32));

          validChallenge = challengeData == transactionHash;
          console.log("validChallenge");
          console.logBool(validChallenge);
        } else if (Strings.equal(keyOrValue, "type")) {
          string memory keyOrValue = JsmnSolLib.getBytes(clientDataJSON, t.start, t.end);
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory typeValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (validType) {
            console.log("duplicate type field, bad json");
            return false;
          }
          validType = Strings.equal("webauthn.get", typeValue);
          console.log("valid type");
          console.logBool(validType);
        }
        // TODO: provide & check 'origin' and/or 'cross-origin' keys as part of signature
      }
    }

    if (!validChallenge || !validType) {
      console.log("invalid challenge or type");
      return false;
    }

    bytes32 message = _createMessage(authenticatorData, bytes(clientDataJSON));
    valid = callVerifier(P256_VERIFIER, message, rs, pubKey);
  }

  function rawVerify(
    bytes32 message,
    bytes32[2] calldata rs,
    bytes32[2] calldata pubKey
  ) external view returns (bool valid) {
    valid = callVerifier(P256_VERIFIER, message, rs, pubKey);
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
}
