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

  event OidcKeyUpdated(address indexed account, bytes iss, bool isNew);

  struct OidcData {
    bytes32 oidcDigest; // PoseidonHash(sub || aud || iss || salt)
    bytes iss; // Issuer
    bytes aud; // Audience
  }

  struct ZkProof {
    uint[2] pA;
    uint[2][2] pB;
    uint[2] pC;
  }

  struct OidcSignature {
    ZkProof zkProof;
    OidcKeyRegistry.Key key;
    bytes32[] merkleProof;
  }

  mapping(address => OidcData) accountData;
  mapping(bytes32 => address) digestIndex;

  address public keyRegistry;
  address public verifier;
  address public webAuthValidator;

  constructor(address _keyRegistry, address _verifier, address _webAuthValidator) {
    initialize(_keyRegistry, _verifier, _webAuthValidator);
  }

  function initialize(address _keyRegistry, address _verifier, address _webAuthValidator) public initializer {
    keyRegistry = _keyRegistry;
    verifier = _verifier;
    webAuthValidator = _webAuthValidator;
  }

  /// @notice Runs on module install
  /// @param data ABI-encoded OidcData key to add immediately, or empty if not needed
  function onInstall(bytes calldata data) external override {
    if (data.length > 0) {
      require(addValidationKey(data), "OidcRecoveryValidator: key already exists");
    }
  }

  /// @notice Runs on module uninstall
  /// @param data unused
  function onUninstall(bytes calldata data) external override {
    accountData[msg.sender] = OidcData(bytes32(0), bytes(""), bytes(""));
  }

  /// @notice Adds an `OidcData` for the caller.
  /// @param key ABI-encoded `OidcData`.
  /// @return true if the key was added, false if it was updated.
  function addValidationKey(bytes calldata key) public returns (bool) {
    OidcData memory oidcData = abi.decode(key, (OidcData));

    bool isNew = accountData[msg.sender].oidcDigest.length == 0;
    accountData[msg.sender] = oidcData;

    if (digestIndex[oidcData.oidcDigest] != address(0)) {
      revert("oidc_digest already registered in other account");
    }

    digestIndex[oidcData.oidcDigest] = msg.sender;

    emit OidcKeyUpdated(msg.sender, oidcData.iss, isNew);
    return isNew;
  }

  /// @notice Validates a transaction to add a new passkey for the user.
  /// @dev Ensures the transaction calls `addValidationKey` in `WebAuthValidator` and verifies the zk proof.
  ///      - Queries `OidcKeyRegistry` for the provider's public key (`pkop`).
  ///      - Calls the verifier contract to validate the zk proof.
  ///      - If the proof is valid, the transaction is approved, allowing `WebAuthValidator` to add the passkey.
  /// @param signedHash The hash of the transaction data that was signed.
  /// @param transaction The transaction data being validated.
  /// @return true if the transaction is valid and authorized, false otherwise.
  function validateTransaction(bytes32 signedHash, Transaction calldata transaction) external view returns (bool) {
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

    OidcKeyRegistry keyRegistryContract = OidcKeyRegistry(keyRegistry);
    Groth16Verifier verifierContract = Groth16Verifier(verifier);

    (bytes memory signature, , ) = abi.decode(transaction.signature, (bytes, address, bytes));
    OidcSignature memory oidcSignature = abi.decode(signature, (OidcSignature));
    OidcData memory oidcData = accountData[msg.sender];
    OidcKeyRegistry.Key memory key = oidcSignature.key;
    require(
      keyRegistryContract.verifyKey(key, oidcSignature.merkleProof),
      "OidcRecoveryValidator: oidc provider pub key not present in key registry"
    );

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
    publicInputs[index] = _reverse(uint256(signedHash) >> 8) >> 8;
    index++;
    publicInputs[index] = (uint256(signedHash) << 248) >> 248;

    require(
      verifierContract.verifyProof(
        oidcSignature.zkProof.pA,
        oidcSignature.zkProof.pB,
        oidcSignature.zkProof.pC,
        publicInputs
      ),
      "OidcRecoveryValidator: zk proof verification failed"
    );

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

  function oidcDataForAddress(address account) public view returns (OidcData[] memory) {
    OidcData memory data = accountData[account];
    OidcData[] memory array;

    if (data.oidcDigest == bytes32(0)) {
      return array;
    }

    array = new OidcData[](1);
    array[0] = data;
    return array;
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
