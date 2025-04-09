// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import { WebAuthValidator } from "./WebAuthValidator.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import { IModule } from "../interfaces/IModule.sol";
import { VerifierCaller } from "../helpers/VerifierCaller.sol";
import { OidcKeyRegistry } from "../OidcKeyRegistry.sol";
import { Groth16Verifier } from "../autogenerated/JwtTxValidationVerifier.sol";
import { Utils } from "../helpers/Utils.sol";
import { IValidatorManager } from "../interfaces/IValidatorManager.sol";

/// @title OidcRecoveryValidator
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev This contract allows secure account recovery for an SSO account using OIDC (Open Id Connect) protocol.
contract OidcRecoveryValidator is VerifierCaller, IModuleValidator, Initializable {
  /// @notice The number of public inputs for the zk proof.
  uint8 constant PUB_SIGNALS_LENGTH = 20;

  /// @notice Emitted when an SSO account updates their associated OIDC account.
  /// @param account The address of the SSO account that updated their OIDC data.
  /// @param oidcDigest Digest generated from data that identifies the user. Calculated as: PoseidonHash(iss || aud || sub || salt).
  /// @param iss The OIDC issuer.
  /// @param isNew True if the OIDC key is new, false if it is an update.
  event OidcAccountUpdated(address indexed account, bytes32 oidcDigest, string iss, bool isNew);

  /// @notice Emitted when an OIDC account is deleted.
  /// @param account The address of the SSO account that deleted the associated OIDC data.
  /// @param oidcDigest The PoseidonHash(iss || aud || sub || salt) of the OIDC key.
  event OidcAccountDeleted(address indexed account, bytes32 oidcDigest);

  /// @notice Thrown when calling `validateSignature` since it is not implemented.
  error ValidateSignatureNotImplemented();

  /// @notice Thrown when no address is found for a given OIDC digest.
  /// @param digest The OIDC digest.
  error AddressNotFoundForDigest(bytes32 digest);

  /// @notice Thrown when trying to add an OIDC account with an OIDC digest that is already registered in another account.
  /// @param digest The OIDC digest.
  error OidcDigestAlreadyRegisteredInAnotherAccount(bytes32 digest);

  /// @notice Thrown when there is no OIDC data for a given address.
  /// @param account The address.
  error NoOidcDataForGivenAddress(address account);

  /// @notice Thrown when the zk proof verification fails.
  error ZkProofVerificationFailed();

  /// @notice Thrown when the time limit has expired.
  error TimeLimitExpired();

  error WebAuthValidatorNotPresentInAccount(address account);

  /// @notice The data for an OIDC account.
  /// @param oidcDigest Digest that identifies an account. It's calculated as: PoseidonHash(iss || aud || sub || salt) of the OIDC key.
  /// @param iss The OIDC issuer.
  /// @param readyToRecover Indicating if recovery is active (true after `startRecovery` and false once recovery is completed).
  /// @param pendingPasskeyHash The hash of the pending passkey.
  /// @param recoverNonce The value is used to build the jwt nonce, and gets incremented each time a zk proof is successfully verified to prevent replay attacks.
  /// @param addedOn The timestamp when the OIDC account was added.
  struct OidcData {
    bytes32 oidcDigest;
    string iss;
    bool readyToRecover;
    bytes32 pendingPasskeyHash;
    uint256 recoverNonce;
    uint256 addedOn;
  }

  /// @notice Data needed to associate a new oidc account to an sso account.
  /// @param oidcDigest The PoseidonHash(iss || aud || sub || salt) of the OIDC key.
  /// @param iss The OIDC issuer. See https://openid.net/specs/openid-connect-core-1_0.html#IDToken
  struct OidcCreationData {
    bytes32 oidcDigest;
    string iss;
  }

  /// @notice The data for a zk proof. pB is expected to be already in the order needed for the verifier.
  struct ZkProof {
    uint[2] pA;
    uint[2][2] pB;
    uint[2] pC;
  }

  /// @notice The data for starting a recovery process.
  /// @param zkProof The zk proof.
  /// @param issHash The hash of the OIDC issuer.
  /// @param kid The key id (kid) of the OIDC key.
  /// @param pendingPasskeyHash The hash of the pending passkey to be added.
  /// @param timeLimit If the recovery process is started after this moment it will fail.
  struct StartRecoveryData {
    ZkProof zkProof;
    bytes32 kid;
    bytes32 pendingPasskeyHash;
    uint256 timeLimit;
  }

  /// @notice The mapping of account addresses to their OIDC data.
  mapping(address account => OidcData oidcData) accountData;

  /// @notice The mapping of OIDC digests to their corresponding account addresses, used to retrieve the user's address during the recovery process.
  mapping(bytes32 oidcDigest => address account) digestIndex;

  /// @notice The address of the OIDC key registry.
  address public keyRegistry;

  /// @notice The address of the zk verifier.
  address public verifier;

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

    keyRegistry = _keyRegistry;
    verifier = _verifier;
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
  /// @param oidcDigest PoseidonHash(iss || aud || sub || salt).
  /// @param iss The OIDC issuer.
  /// @return true if the key was added, false if it was updated.
  function addOidcAccount(bytes32 oidcDigest, string memory iss) public returns (bool) {
    require(oidcDigest != bytes32(0), "oidcDigest cannot be empty");
    require(bytes(iss).length > 0, "oidcDigest cannot be empty");

    bool isNew = accountData[msg.sender].oidcDigest.length == 0;
    if (digestIndex[oidcDigest] != address(0)) {
      revert OidcDigestAlreadyRegisteredInAnotherAccount(oidcDigest);
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

    OidcKeyRegistry keyRegistryContract = OidcKeyRegistry(keyRegistry);
    Groth16Verifier verifierContract = Groth16Verifier(verifier);

    OidcData memory oidcData = accountData[targetAccount];
    bytes32 issHash = keyRegistryContract.hashIssuer(oidcData.iss);
    OidcKeyRegistry.Key memory key = keyRegistryContract.getKey(issHash, data.kid);

    bytes32 senderHash = keccak256(abi.encode(msg.sender, oidcData.recoverNonce, data.timeLimit));

    // Fill public inputs
    uint8 index = 0;
    uint[PUB_SIGNALS_LENGTH] memory publicInputs;

    // First CIRCOM_BIGINT_CHUNKS elements are the oidc provider public key.
    for (uint8 i = 0; i < key.n.length; ++i) {
      publicInputs[index] = uint(key.n[i]);
      ++index;
    }

    // Then the digest
    publicInputs[index] = uint(oidcData.oidcDigest);
    ++index;

    // Lastly the sender hash split into two 31-byte chunks (fields)
    // Reverse ensures correct little-endian representation
    publicInputs[index] = _reverse(uint256(senderHash) >> 8) >> 8;
    ++index;
    publicInputs[index] = (uint256(senderHash) << 248) >> 248;

    if (!verifierContract.verifyProof(data.zkProof.pA, data.zkProof.pB, data.zkProof.pC, publicInputs)) {
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
    uint256 shifted = input;
    uint256 mask = 0xff;

    for (uint i = 0; i < 32; ++i) {
      uint256 oneByte = (shifted & mask) << ((32 - i - 1) * 8);
      shifted = shifted >> 8;
      res = res + oneByte;
    }

    return res;
  }
}
