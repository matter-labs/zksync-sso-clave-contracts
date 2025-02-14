// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import { IModule } from "../interfaces/IModule.sol";
import { VerifierCaller } from "../helpers/VerifierCaller.sol";
import { OidcKeyRegistry } from "../OidcKeyRegistry.sol";

/// @title OidcValidator
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev This contract allows secure user authentication using OIDC protocol.
contract OidcValidator is VerifierCaller, IModuleValidator {
  event OidcKeyUpdated(address indexed account, bytes iss, bool isNew);

  struct OidcData {
    bytes oidcDigest; // PoseidonHash(sub || aud || iss || salt)
    bytes iss; // Issuer
    bytes aud; // Audience
  }

  struct OidcSignature {
    bytes zkProof;
    bytes32 issHash; // Hash of the issuer
    bytes32 kid; // Key id used in the jwt
  }

  mapping(address => OidcData) public accountData;

  address public immutable keyRegistry;
  address public immutable verifier;

  constructor(address _keyRegistry, address _verifier) {
    keyRegistry = _keyRegistry;
    verifier = _verifier;
  }

  /// @notice Runs on module install
  /// @param data ABI-encoded OidcData key to add immediately, or empty if not needed
  function onInstall(bytes calldata data) external override {
    if (data.length > 0) {
      require(addValidationKey(data), "OidcValidator: key already exists");
    }
  }

  /// @notice Runs on module uninstall
  /// @param data unused
  function onUninstall(bytes calldata data) external override {
    accountData[msg.sender] = OidcData(bytes(""), bytes(""), bytes(""));
  }

  /// @notice Adds an `OidcData` for the caller.
  /// @param key ABI-encoded `OidcData`.
  /// @return true if the key was added, false if it was updated.
  function addValidationKey(bytes calldata key) public returns (bool) {
    OidcData memory oidcData = abi.decode(key, (OidcData));

    bool isNew = accountData[msg.sender].oidcDigest.length == 0;
    accountData[msg.sender] = oidcData;

    emit OidcKeyUpdated(msg.sender, oidcData.iss, isNew);
    return isNew;
  }

  /// @notice Validates a transaction to add a new passkey for the user.
  /// @dev Ensures the transaction calls `addValidationKey` in `WebAuthValidator` and verifies the zk proof.
  ///      - Queries `OidcKeyRegistry` for the provider's public key (`pkop`).
  ///      - Calls the verifier contract to validate the zk proof.
  ///      - If the proof is valid, the transaction is approved, allowing `WebAuthValidator` to add the passkey.
  /// @param signedHash The hash of the transaction data that was signed.
  /// @param signature The signature to be verified, interpreted as an `OidcSignature`.
  /// @param transaction The transaction data being validated.
  /// @return true if the transaction is valid and authorized, false otherwise.
  function validateTransaction(
    bytes32 signedHash,
    bytes calldata signature,
    Transaction calldata transaction
  ) external view returns (bool) {
    OidcKeyRegistry keyRegistryContract = OidcKeyRegistry(keyRegistry);
    OidcSignature memory oidcSignature = abi.decode(signature, (OidcSignature));
    OidcKeyRegistry.Key memory key = keyRegistryContract.getKey(oidcSignature.issHash, oidcSignature.kid);

    revert("OidcValidator: validateTransaction not implemented");
  }

  /// @notice Unimplemented because signature validation is not required.
  /// @dev We only need `validateTransaction` to add new passkeys, so this function is intentionally left unimplemented.
  function validateSignature(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    revert("OidcValidator: validateSignature not implemented");
  }

  /// @inheritdoc IERC165
  function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
    return
      interfaceId == type(IERC165).interfaceId ||
      interfaceId == type(IModuleValidator).interfaceId ||
      interfaceId == type(IModule).interfaceId;
  }
}
