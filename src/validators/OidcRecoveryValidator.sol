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

/// @title OidcRecoveryValidator
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev This contract allows secure user authentication using OIDC protocol.
contract OidcRecoveryValidator is VerifierCaller, IModuleValidator, Initializable {
  uint8 constant PUB_SIGNALS_LENGTH = 20;

  event OidcKeyUpdated(address indexed account, bytes32 oidcDigest, string iss, bool isNew);

  struct OidcData {
    bytes32 oidcDigest; // PoseidonHash(sub || aud || iss || salt)
    string iss;
    bool readyToRecover;
    bytes32 pendingPasskeyHash;
    uint256 recoverNonce;
  }

  struct OidcCreationData {
    bytes32 oidcDigest; // PoseidonHash(sub || aud || iss || salt)
    string iss;
  }

  struct ZkProof {
    uint[2] pA;
    uint[2][2] pB;
    uint[2] pC;
  }

  struct StartRecoveryData {
    ZkProof zkProof;
    bytes32 issHash;
    bytes32 kid;
    bytes32 pendingPasskeyHash;
  }

  mapping(address => OidcData) accountData;
  mapping(bytes32 => address) digestIndex;

  address public keyRegistry;
  address public verifier;
  address public webAuthValidator;

  constructor() {
    _disableInitializers();
  }

  function initialize(address _keyRegistry, address _verifier, address _webAuthValidator) public initializer {
    keyRegistry = _keyRegistry;
    verifier = _verifier;
    webAuthValidator = _webAuthValidator;
  }

  /// @notice Runs on module install
  /// @param data ABI-encoded OidcCreationData key to add immediately, or empty if not needed
  function onInstall(bytes calldata data) external override {
    OidcCreationData memory oidcCreationData = abi.decode(data, (OidcCreationData));
    if (data.length > 0) {
      require(
        addOidcAccount(oidcCreationData.oidcDigest, oidcCreationData.iss),
        "OidcRecoveryValidator: key already exists"
      );
    }
  }

  /// @notice Runs on module uninstall
  /// @param data unused
  function onUninstall(bytes calldata data) external override {
    _deleteValidationKey();
  }

  /// @notice Adds an `OidcData` for the caller.
  /// @param oidcDigest PoseidonHash(sub || aud || iss || salt).
  /// @param iss The OIDC issuer.
  /// @return true if the key was added, false if it was updated.
  function addOidcAccount(bytes32 oidcDigest, string memory iss) public returns (bool) {
    bool isNew = accountData[msg.sender].oidcDigest.length == 0;
    if (digestIndex[oidcDigest] != address(0)) {
      revert("oidc_digest already registered in other account");
    }

    accountData[msg.sender].oidcDigest = oidcDigest;
    accountData[msg.sender].iss = iss;
    digestIndex[oidcDigest] = msg.sender;

    emit OidcKeyUpdated(msg.sender, oidcDigest, iss, isNew);
    return isNew;
  }

  function deleteValidationKey() external {
    _deleteValidationKey();
  }

  function _deleteValidationKey() private {
    bytes32 digest = accountData[msg.sender].oidcDigest;
    delete digestIndex[digest];
    delete accountData[msg.sender];
  }

  function startRecovery(StartRecoveryData calldata data, address targetAccount) external {
    OidcKeyRegistry keyRegistryContract = OidcKeyRegistry(keyRegistry);
    Groth16Verifier verifierContract = Groth16Verifier(verifier);

    OidcData memory oidcData = accountData[targetAccount];
    OidcKeyRegistry.Key memory key = keyRegistryContract.getKey(data.issHash, data.kid);

    bytes32 senderHash = keccak256(abi.encode(msg.sender, oidcData.recoverNonce));

    // Fill public inputs
    uint8 index = 0;
    uint[PUB_SIGNALS_LENGTH] memory publicInputs;

    for (uint8 i = 0; i < key.n.length; i++) {
      publicInputs[index] = uint(key.n[i]);
      index++;
    }

    publicInputs[index] = uint(oidcData.oidcDigest);
    index++;

    // Add tx hash split into two 31-byte chunks (fields)
    // Reverse ensures correct little-endian representation
    publicInputs[index] = _reverse(uint256(senderHash) >> 8) >> 8;
    index++;
    publicInputs[index] = (uint256(senderHash) << 248) >> 248;

    require(
      verifierContract.verifyProof(data.zkProof.pA, data.zkProof.pB, data.zkProof.pC, publicInputs),
      "OidcRecoveryValidator: zk proof verification failed"
    );

    accountData[targetAccount].pendingPasskeyHash = data.pendingPasskeyHash;
    accountData[targetAccount].recoverNonce++;
    accountData[targetAccount].readyToRecover = true;
  }

  /// @notice Validates a transaction to add a new passkey for the user.
  /// @dev Ensures the transaction calls `addValidationKey` in `WebAuthValidator` and verifies the zk proof.
  ///      - Queries `OidcKeyRegistry` for the provider's public key (`pkop`).
  ///      - Calls the verifier contract to validate the zk proof.
  ///      - If the proof is valid, the transaction is approved, allowing `WebAuthValidator` to add the passkey.
  /// @param signedHash The hash of the transaction data that was signed.
  /// @param transaction The transaction data being validated.
  /// @return true if the transaction is valid and authorized, false otherwise.
  function validateTransaction(bytes32 signedHash, Transaction calldata transaction) external returns (bool) {
    require(transaction.to <= type(uint160).max, "OidcRecoveryValidator: Transaction.to overflow");
    require(
      address(uint160(transaction.to)) == webAuthValidator,
      "OidcRecoveryValidator: invalid webauthn validator address"
    );

    require(transaction.data.length >= 4, "Only function calls are supported");
    bytes4 selector = bytes4(transaction.data[:4]);

    // Check for calling "addValidationKey" method by anyone on WebAuthValidator contract
    require(
      selector == WebAuthValidator.addValidationKey.selector,
      "OidcRecoveryValidator: Unauthorized function call"
    );

    // Decode the key from the transaction data and check against the pending passkey hash
    (, bytes32[2] memory newPasskeyPubKey, ) = abi.decode(transaction.data[4:], (bytes, bytes32[2], string));
    bytes32 passkeyHash = keccak256(abi.encode(newPasskeyPubKey[0], newPasskeyPubKey[1]));
    OidcData memory oidcData = accountData[msg.sender];

    require(oidcData.pendingPasskeyHash == passkeyHash, "OidcRecoveryValidator: Invalid passkey hash");
    require(oidcData.readyToRecover, "OidcRecoveryValidator: Not ready to recover");

    // Reset pending passkey hash
    accountData[msg.sender].pendingPasskeyHash = bytes32(0);
    accountData[msg.sender].readyToRecover = false;

    return true;
  }

  /// @notice Unimplemented because signature validation is not required.
  /// @dev We only need `validateTransaction` to add new passkeys, so this function is intentionally left unimplemented.
  function validateSignature(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    revert("OidcRecoveryValidator: validateSignature not implemented");
  }

  /// @inheritdoc IERC165
  function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
    return
      interfaceId == type(IERC165).interfaceId ||
      interfaceId == type(IModuleValidator).interfaceId ||
      interfaceId == type(IModule).interfaceId;
  }

  function addressForDigest(bytes32 digest) public view returns (address) {
    address addr = digestIndex[digest];
    if (addr == address(0)) {
      revert("Address not found for given digest.");
    }

    return digestIndex[digest];
  }

  function oidcDataForAddress(address account) public view returns (OidcData memory) {
    OidcData memory data = accountData[account];

    if (data.oidcDigest == bytes32(0)) {
      revert("OidcRecoveryValidator: No oidc data for given address");
    }

    return data;
  }

  // Reverse byte order
  // Algorithm taken from https://graphics.stanford.edu/%7Eseander/bithacks.html#ReverseParallel
  function _reverse(uint256 input) internal pure returns (uint256 v) {
    v = input;

    // swap bytes
    v =
      ((v & 0xFF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00) >> 8) |
      ((v & 0x00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF) << 8);

    // swap 2-byte long pairs
    v =
      ((v & 0xFFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000) >> 16) |
      ((v & 0x0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF) << 16);

    // swap 4-byte long pairs
    v =
      ((v & 0xFFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000) >> 32) |
      ((v & 0x00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF) << 32);

    // swap 8-byte long pairs
    v =
      ((v & 0xFFFFFFFFFFFFFFFF0000000000000000FFFFFFFFFFFFFFFF0000000000000000) >> 64) |
      ((v & 0x0000000000000000FFFFFFFFFFFFFFFF0000000000000000FFFFFFFFFFFFFFFF) << 64);

    // swap 16-byte long pairs
    v = (v >> 128) | (v << 128);
  }
}
