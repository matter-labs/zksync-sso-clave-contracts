// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import { WebAuthValidator } from "./WebAuthValidator.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import { IModule } from "../interfaces/IModule.sol";
import { OidcKeyRegistry } from "../OidcKeyRegistry.sol";
import { Groth16Verifier } from "../autogenerated/JwtTxValidationVerifier.sol";
import { Utils } from "../helpers/Utils.sol";
import { IValidatorManager } from "../interfaces/IValidatorManager.sol";
import { IOidcRecoveryValidator } from "../interfaces/IOidcRecoveryValidator.sol";
import { IOidcKeyRegistry } from "../interfaces/IOidcKeyRegistry.sol";
import { IZkVerifier } from "../interfaces/IZkVerifier.sol";

/// @title OidcRecoveryValidator
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev This contract allows secure account recovery for an SSO account using OIDC (Open Id Connect) protocol.
contract OidcRecoveryValidator is IOidcRecoveryValidator, Initializable {
  /// @notice The number of public inputs for the zk proof.
  uint256 constant PUB_SIGNALS_LENGTH = 20;

  /// @dev Size of a byte in bits. Used for byte shifting operations across the contract.
  uint256 private constant BITS_IN_A_BYTE = 8;
  uint256 private constant BYTES_IN_A_WORD = 32;
  uint256 private constant LAST_BYTE_MASK = uint256(0xff);

  /// @notice The mapping of account addresses to their OIDC data.
  mapping(address account => OidcData oidcData) accountData;

  /// @notice The mapping of OIDC digests to their corresponding account addresses, used to retrieve the user's address during the recovery process.
  mapping(bytes32 oidcDigest => address account) digestIndex;

  /// @notice The address of the OIDC key registry.
  IOidcKeyRegistry public keyRegistry;

  /// @notice The address of the zk verifier.
  IZkVerifier public verifier;

  /// @notice The address of the web authentication validator.
  address public webAuthValidator;

  constructor() {
    _disableInitializers();
  }

  /// @notice Initializes the validator.
  /// @param _keyRegistry The address of the OIDC key registry.
  /// @param _verifier The address of the zk verifier.
  /// @param _webAuthValidator The address of the web authentication validator.
  function initialize(address _keyRegistry, address _verifier, address _webAuthValidator) external initializer {
    require(_keyRegistry != address(0), "_keyRegistry cannot be zero address");
    require(_verifier != address(0), "_verifier cannot be zero address");
    require(_webAuthValidator != address(0), "_webAuthValidator cannot be zero address");

    keyRegistry = IOidcKeyRegistry(_keyRegistry);
    verifier = IZkVerifier(_verifier);
    webAuthValidator = _webAuthValidator;
  }

  /// @notice Runs on module install
  /// @param data ABI-encoded OidcCreationData key to add immediately, or empty if not needed
  function onInstall(bytes calldata data) external override {
    IValidatorManager asValidator = IValidatorManager(msg.sender);

    bool passKeyModuleIsPresent = asValidator.isModuleValidator(webAuthValidator);
    if (!passKeyModuleIsPresent) {
      revert WebAuthValidatorNotPresentInAccount(msg.sender);
    }

    if (data.length > 0) {
      OidcCreationData memory oidcCreationData = abi.decode(data, (OidcCreationData));
      addOidcAccount(oidcCreationData.oidcDigest, oidcCreationData.iss);
    }
  }

  /// @notice Runs on module uninstall
  /// @dev Deletes the OIDC account for the caller, freeing it for use by another SSO account.
  function onUninstall(bytes calldata) external override {
    _deleteOidcAccount();
  }

  /// @notice Adds an `OidcData` for the caller.
  /// @param oidcDigest PoseidonHash(sub || aud || iss || salt).
  /// @param iss The OIDC issuer.
  /// @return true if the key was added, false if it was updated.
  function addOidcAccount(bytes32 oidcDigest, string memory iss) public returns (bool) {
    require(oidcDigest != bytes32(0), "oidcDigest cannot be empty");
    require(bytes(iss).length > 0, "oidcDigest cannot be empty");

    bool isNew = accountData[msg.sender].oidcDigest.length == 0;
    if (digestIndex[oidcDigest] != address(0)) {
      revert OidcDigestAlreadyRegisteredInAnotherAccount(digestIndex[oidcDigest]);
    }

    accountData[msg.sender].oidcDigest = oidcDigest;
    accountData[msg.sender].iss = iss;
    accountData[msg.sender].addedOn = block.timestamp;
    digestIndex[oidcDigest] = msg.sender;

    emit OidcAccountUpdated(msg.sender, oidcDigest, iss, isNew);
    return isNew;
  }

  /// @notice Deletes the OIDC account for the caller, freeing it for use by another SSO account.
  function deleteOidcAccount() external {
    _deleteOidcAccount();
  }

  /// @notice Deletes the OIDC account for the caller, freeing it for use by another SSO account.
  function _deleteOidcAccount() private {
    bytes32 digest = accountData[msg.sender].oidcDigest;
    delete digestIndex[digest];
    delete accountData[msg.sender];

    emit OidcAccountDeleted(msg.sender, digest);
  }

  /// @notice Starts the recovery process for the target account.
  /// @param data The data for starting a recovery process.
  /// @param targetAccount The address of the account to start the recovery process for.
  /// @dev Queries the OIDC key registry for the provider's public key (`pkop`).
  /// @dev Calls the verifier contract to validate the zk proof.
  /// @dev If the proof is valid, it sets the recovery data for the target account.
  function startRecovery(StartRecoveryData calldata data, address targetAccount) external {
    if (data.timeLimit < block.timestamp) {
      revert TimeLimitExpired();
    }

    OidcData memory oidcData = accountData[targetAccount];
    bytes32 issHash = keyRegistry.hashIssuer(oidcData.iss);
    OidcKeyRegistry.Key memory key = keyRegistry.getKey(issHash, data.kid);

    bytes32 senderHash = keccak256(abi.encode(msg.sender, oidcData.recoverNonce, data.timeLimit));

    // Fill public inputs
    uint256[PUB_SIGNALS_LENGTH] memory publicInputs;

    // First CIRCOM_BIGINT_CHUNKS elements are the oidc provider public key.
    for (uint256 i = 0; i < key.n.length; ++i) {
      publicInputs[i] = key.n[i];
    }
    uint256 pubSignalsIndex = key.n.length;

    // Then the digest
    publicInputs[pubSignalsIndex] = uint256(oidcData.oidcDigest);

    // Lastly the sender hash split into two 31-byte chunks (fields)
    // Reverse ensures correct little-endian representation
    publicInputs[pubSignalsIndex + 1] = _reverse(uint256(senderHash) >> BITS_IN_A_BYTE) >> BITS_IN_A_BYTE;
    publicInputs[pubSignalsIndex + 2] = uint256(senderHash) & LAST_BYTE_MASK;

    if (!verifier.verifyProof(data.zkProof.pA, data.zkProof.pB, data.zkProof.pC, publicInputs)) {
      revert ZkProofVerificationFailed();
    }

    accountData[targetAccount].pendingPasskeyHash = data.pendingPasskeyHash;
    accountData[targetAccount].recoverNonce += 1;
    accountData[targetAccount].readyToRecover = true;
  }

  /// @notice Only allows transaction setting a new passkey for the sender, and only if `startRecovery` was successfully
  ///         called before
  /// @dev Only allows calls to `addValidationKey` on the `WebAuthValidator` contract.
  /// @dev Validates that the transaction adds the pending passkey to the account.
  /// @dev It only allows to use passkeys previously set in `startRecovery`
  /// @param transaction The transaction data being validated.
  /// @return true if the transaction is valid and authorized, false otherwise.
  function validateTransaction(bytes32, Transaction calldata transaction) external returns (bool) {
    address target = Utils.safeCastToAddress(transaction.to);
    if (target != webAuthValidator) {
      return false;
    }

    if (transaction.data.length < 4) {
      return false;
    }

    bytes4 selector = bytes4(transaction.data[:4]);

    // Check for calling "addValidationKey" method by anyone on WebAuthValidator contract
    if (selector != WebAuthValidator.addValidationKey.selector) {
      return false;
    }

    // Decode the key from the transaction data and check against the pending passkey hash
    (, bytes32[2] memory newPasskeyPubKey, ) = abi.decode(transaction.data[4:], (bytes, bytes32[2], string));
    bytes32 passkeyHash = keccak256(abi.encode(newPasskeyPubKey[0], newPasskeyPubKey[1]));
    OidcData memory oidcData = accountData[msg.sender];

    if (!oidcData.readyToRecover) {
      return false;
    }

    if (oidcData.pendingPasskeyHash != passkeyHash) {
      return false;
    }

    // Reset pending passkey hash
    accountData[msg.sender].pendingPasskeyHash = bytes32(0);
    accountData[msg.sender].readyToRecover = false;
    return true;
  }

  /// @notice Unimplemented because signature validation is not required.
  /// @dev This module is only used to set new passkeys, arbitrary signature validation is out of the scope of this module.
  function validateSignature(bytes32, bytes memory) external pure returns (bool) {
    revert ValidateSignatureNotImplemented();
  }

  /// @inheritdoc IERC165
  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return
      interfaceId == type(IERC165).interfaceId ||
      interfaceId == type(IModuleValidator).interfaceId ||
      interfaceId == type(IModule).interfaceId;
  }

  /// @notice Returns the address for a given OIDC digest.
  /// @param digest The OIDC digest.
  /// @return account The address for the given OIDC digest.
  function addressForDigest(bytes32 digest) external view returns (address) {
    address addr = digestIndex[digest];
    if (addr == address(0)) {
      revert AddressNotFoundForDigest(digest);
    }

    return addr;
  }

  /// @notice Returns the OIDC data for a given address.
  /// @param account The address to get the OIDC data for.
  /// @return data The OIDC data for the given address.
  function oidcDataForAddress(address account) external view returns (OidcData memory) {
    OidcData memory data = accountData[account];

    if (data.oidcDigest == bytes32(0)) {
      revert NoOidcDataForGivenAddress(account);
    }

    return data;
  }

  /// @notice Reverses the byte order of a given uint256.
  /// @param input The uint256 to reverse.
  /// @return uint256 The reversed version of the input.
  function _reverse(uint256 input) private pure returns (uint256) {
    uint256 res = 0;
    // this number will be consumed byte by byte
    uint256 shifted = input;

    for (uint256 i = 0; i < BYTES_IN_A_WORD; ++i) {
      // Take last byte
      uint256 oneByte = (shifted & LAST_BYTE_MASK);
      // Move byte to next empty position
      oneByte = oneByte << ((BYTES_IN_A_WORD - i - 1) * BITS_IN_A_BYTE);
      // Accumulate result
      res = res + oneByte;
      // Advance to next byte;
      shifted = shifted >> BITS_IN_A_BYTE;
    }

    return res;
  }
}
