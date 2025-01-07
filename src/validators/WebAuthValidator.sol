// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import { VerifierCaller } from "../helpers/VerifierCaller.sol";
import { JsmnSolLib } from "../libraries/JsmnSolLib.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64 } from "solady/src/utils/Base64.sol";

/// @title AAFactory
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev This contract allows secure user authentication using WebAuthn public keys.
contract WebAuthValidator is VerifierCaller, IModuleValidator {
  address private constant P256_VERIFIER = address(0x100);
  bytes1 private constant AUTH_DATA_MASK = 0x05;
  bytes32 private constant LOW_S_MAX = 0x7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8;
  bytes32 private constant HIGH_R_MAX = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551;

  // The layout is weird due to EIP-7562 storage read restrictions for validation phase.
  mapping(string originDomain => mapping(address accountAddress => bytes32)) public lowerKeyHalf;
  mapping(string originDomain => mapping(address accountAddress => bytes32)) public upperKeyHalf;

  function init(bytes calldata key) external {
    require(_addValidationKey(key), "failed to init");
  }

  function addValidationKey(bytes memory key) external returns (bool) {
    return _addValidationKey(key);
  }

  // There's no mapping from account address to domains,
  // so there's no way to just delete all the keys
  // We can only disconnect the module from the account,
  // re-linking it will allow any previous keys
  function disable() external pure {
    revert("Cannot disable module without removing it from account");
  }

  function _addValidationKey(bytes memory key) internal returns (bool) {
    (bytes32[2] memory key32, string memory originDomain) = abi.decode(key, (bytes32[2], string));
    bytes32 initialLowerHalf = lowerKeyHalf[originDomain][msg.sender];
    bytes32 initialUpperHalf = upperKeyHalf[originDomain][msg.sender];

    // we might want to support multiple passkeys per domain
    lowerKeyHalf[originDomain][msg.sender] = key32[0];
    upperKeyHalf[originDomain][msg.sender] = key32[1];

    // we're returning true if this was a new key, false for update
    return initialLowerHalf == 0 && initialUpperHalf == 0;
  }

  function validateSignature(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    return webAuthVerify(signedHash, signature);
  }

  function validateTransaction(
    bytes32 signedHash,
    bytes memory signature,
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

    // parse out the important fields (type, challenge, and origin): https://goo.gl/yabPex
    (uint256 returnValue, JsmnSolLib.Token[] memory tokens, uint256 actualNum) = JsmnSolLib.parse(clientDataJSON, 20);
    if (returnValue != 0 || actualNum < 3) {
      return false;
    }

    bytes32[2] memory pubKey;

    // look for fields by name, then compare to expected values
    bool validChallenge = false;
    bool validType = false;
    bool validOrigin = false;
    bool validCrossOrigin = true;
    for (uint256 index = 1; index < actualNum; index++) {
      JsmnSolLib.Token memory t = tokens[index];
      if (t.jsmnType == JsmnSolLib.JsmnType.STRING) {
        string memory keyOrValue = JsmnSolLib.getBytes(clientDataJSON, t.start, t.end);
        if (Strings.equal(keyOrValue, "challenge")) {
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory challengeValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (validChallenge) {
            return false;
          }
          // this is the key part to ensure the signature is for the provided transaction
          bytes memory challengeDataArray = Base64.decode(challengeValue);
          if (challengeDataArray.length != 32) {
            // wrong hash size
            return false;
          }
          bytes32 challengeData = abi.decode(challengeDataArray, (bytes32));

          validChallenge = challengeData == transactionHash;
          if (!validChallenge) {
            return false;
          }
        } else if (Strings.equal(keyOrValue, "type")) {
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory typeValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (validType) {
            return false;
          }
          validType = Strings.equal("webauthn.get", typeValue);
          if (!validType) {
            return false;
          }
        } else if (Strings.equal(keyOrValue, "origin")) {
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory originValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (validOrigin) {
            return false;
          }
          pubKey[0] = lowerKeyHalf[originValue][msg.sender];
          pubKey[1] = upperKeyHalf[originValue][msg.sender];

          // This really only validates the origin is set
          validOrigin = pubKey[0] != 0 && pubKey[1] != 0;
          if (!validOrigin) {
            return false;
          }
        } else if (Strings.equal(keyOrValue, "crossOrigin")) {
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory crossOriginValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (!validCrossOrigin) {
            return false;
          }
          validCrossOrigin = Strings.equal("false", crossOriginValue);
          if (!validCrossOrigin) {
            return false;
          }
        }
      }
    }

    if (!validChallenge || !validType || !validOrigin || !validCrossOrigin) {
      return false;
    }

    bytes32 message = _createMessage(authenticatorData, bytes(clientDataJSON));
    return callVerifier(P256_VERIFIER, message, rs, pubKey);
  }

  function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
    return interfaceId == type(IERC165).interfaceId || interfaceId == type(IModuleValidator).interfaceId;
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
