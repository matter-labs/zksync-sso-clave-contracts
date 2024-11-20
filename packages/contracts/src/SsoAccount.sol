// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ACCOUNT_VALIDATION_SUCCESS_MAGIC } from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IAccount.sol";
import { Transaction, TransactionHelper } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { EfficientCall } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/EfficientCall.sol";
import { NONCE_HOLDER_SYSTEM_CONTRACT, DEPLOYER_SYSTEM_CONTRACT, INonceHolder } from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import { SystemContractsCaller } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";
import { Utils } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/Utils.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import { HookManager } from "./managers/HookManager.sol";
import { ModuleManager } from "./managers/ModuleManager.sol";

import { TokenCallbackHandler, IERC165 } from "./helpers/TokenCallbackHandler.sol";

import { Errors } from "./libraries/Errors.sol";
import { SignatureDecoder } from "./libraries/SignatureDecoder.sol";

import { ERC1271Handler } from "./handlers/ERC1271Handler.sol";
import { BatchCaller } from "./batch/BatchCaller.sol";

import { ISsoAccount } from "./interfaces/ISsoAccount.sol";

/// @title SSO Account
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @notice The implementation is inspired by Clave wallet.
/// @notice This contract is a modular and extensible account implementation with support of
/// multi-ownership, custom modules, validation/execution hooks and different signature validation formats.
/// @dev Contract is expected to be used as Beacon proxy implementation.
contract SsoAccount is
  Initializable,
  HookManager,
  ModuleManager,
  ERC1271Handler,
  TokenCallbackHandler,
  BatchCaller,
  ISsoAccount
{
  // Helper library for the Transaction struct
  using TransactionHelper for Transaction;

  constructor() {
    _disableInitializers();
  }

  /// @notice Initializer function that sets account initial configuration. Expected to be used in the proxy.
  /// @dev Sets passkey and passkey validator within account storage
  /// @param _initialValidators An array of module validator addresses and initial validation keys
  /// in an ABI encoded format of `abi.encode(validatorAddr,validationKey))`.
  /// @param _initialModules An array of native module addresses and their initialize data
  /// in an ABI encoded format of `abi.encode(moduleAddr,initData))`.
  /// @param _initialK1Owners An array of addresses with full control over the account.
  function initialize(
    bytes[] calldata _initialValidators,
    bytes[] calldata _initialModules,
    address[] calldata _initialK1Owners
  ) external initializer {
    for (uint256 i = 0; i < _initialValidators.length; ++i) {
      (address validatorAddr, bytes memory validationKey) = abi.decode(_initialValidators[i], (address, bytes));
      _addModuleValidator(validatorAddr, validationKey);
    }
    for (uint256 i = 0; i < _initialModules.length; ++i) {
      (address moduleAddr, bytes memory initData) = abi.decode(_initialModules[i], (address, bytes));
      _addNativeModule(moduleAddr, initData);
    }
    for (uint256 i = 0; i < _initialK1Owners.length; ++i) {
      _k1AddOwner(_initialK1Owners[i]);
    }
  }

  /// @dev Account might receive/hold base tokens.
  receive() external payable {}

  /// @notice Called by the bootloader to validate that an account agrees to process the transaction
  /// (and potentially pay for it).
  /// @dev The developer should strive to preserve as many steps as possible both for valid
  /// and invalid transactions as this very method is also used during the gas fee estimation
  /// (without some of the necessary data, e.g. signature).
  /// @param _suggestedSignedHash The suggested hash of the transaction that is signed by the signer.
  /// @param _transaction The transaction data.
  /// @return magic The magic value that should be equal to the signature of this function.
  /// if the user agrees to proceed with the transaction.
  function validateTransaction(
    bytes32,
    bytes32 _suggestedSignedHash,
    Transaction calldata _transaction
  ) external payable override onlyBootloader returns (bytes4 magic) {
    // TODO: session txs have their own nonce managers, so they have to not alter this nonce
    _incrementNonce(_transaction.nonce);

    // If there is not enough balance for the transaction, the account should reject it
    // on the validation step to prevent paying fees for revertable transactions.
    if (_transaction.totalRequiredBalance() > address(this).balance) {
      revert Errors.INSUFFICIENT_FUNDS();
    }

    // While the suggested signed hash is usually provided, it is generally
    // not recommended to rely on it to be present, since in the future
    // there may be tx types with no suggested signed hash.
    bytes32 signedHash = _suggestedSignedHash == bytes32(0) ? _transaction.encodeHash() : _suggestedSignedHash;

    magic = _validateTransaction(signedHash, _transaction);
  }

  /// @notice Called by the bootloader to make the account execute the transaction.
  /// @dev The transaction is considered successful if this function does not revert
  /// @param _transaction The transaction data.
  function executeTransaction(
    bytes32,
    bytes32,
    Transaction calldata _transaction
  ) external payable override onlyBootloader runExecutionHooks(_transaction) {
    address to = _safeCastToAddress(_transaction.to);
    uint128 value = Utils.safeCastToU128(_transaction.value);

    _executeCall(to, value, _transaction.data);
  }

  /// @notice Executes a call to a given address with a specified value and calldata.
  /// @param _to The address to which the call is made.
  /// @param _value The value to send along with the call.
  /// @param _data The calldata to pass along with the call.
  function _executeCall(address _to, uint128 _value, bytes calldata _data) internal {
    uint32 gas = Utils.safeCastToU32(gasleft());

    if (_to == address(DEPLOYER_SYSTEM_CONTRACT)) {
      // Note, that the deployer contract can only be called with a "systemCall" flag.
      SystemContractsCaller.systemCallWithPropagatedRevert(gas, _to, _value, _data);
    } else {
      bool success = EfficientCall.rawCall(gas, _to, _value, _data, false);
      if (!success) {
        EfficientCall.propagateRevert();
      }
    }
  }

  /// @notice This function allows an EOA to start a transaction for the account. The main purpose of which is
  /// to have and entry point for escaping funds when L2 transactions are censored by the chain, and only
  /// forced transactions are accepted by the network.
  /// @dev It is not implemented yet.
  /// @param _transaction The transaction data.
  function executeTransactionFromOutside(Transaction calldata _transaction) external payable override {
    revert Errors.METHOD_NOT_IMPLEMENTED();
  }

  /// @notice This function allows the account to pay for its own gas and used when there is no paymaster.
  /// @param _transaction The transaction data.
  /// @dev This method must send at least `tx.gasprice * tx.gasLimit` ETH to the bootloader address.
  function payForTransaction(
    bytes32,
    bytes32,
    Transaction calldata _transaction
  ) external payable override onlyBootloader {
    bool success = _transaction.payToTheBootloader();

    if (!success) {
      revert Errors.FEE_PAYMENT_FAILED();
    }

    emit FeePaid();
  }

  /// @notice This function is called by the system if the transaction has a paymaster
  /// and prepares the interaction with the paymaster.
  /// @param _transaction The transaction data.
  function prepareForPaymaster(
    bytes32,
    bytes32,
    Transaction calldata _transaction
  ) external payable override onlyBootloader {
    _transaction.processPaymasterInput();
  }

  /// @dev type(ISsoAccount).interfaceId indicates SSO accounts
  function supportsInterface(bytes4 interfaceId) public view override(IERC165, TokenCallbackHandler) returns (bool) {
    return interfaceId == type(ISsoAccount).interfaceId || super.supportsInterface(interfaceId);
  }

  /// @notice Validates the provided transaction by validating signature of ECDSA k1 owner.
  /// or running validation hooks and signature validation in the provided validator address.
  /// @param _signedHash The signed hash of the transaction.
  /// @param _transaction The transaction data.
  /// @return The magic value if the validation was successful and bytes4(0) otherwise.
  function _validateTransaction(bytes32 _signedHash, Transaction calldata _transaction) internal returns (bytes4) {
    if (_transaction.signature.length == 65) {
      (address signer, ) = ECDSA.tryRecover(_signedHash, _transaction.signature);
      return _k1IsOwner(signer) ? ACCOUNT_VALIDATION_SUCCESS_MAGIC : bytes4(0);
    }

    // Extract the signature, validator address and hook data from the _transaction.signature
    (bytes memory signature, address validator, bytes[] memory hookData) = SignatureDecoder.decodeSignature(
      _transaction.signature
    );

    // Run validation hooks
    bool hookSuccess = runValidationHooks(_signedHash, _transaction, hookData);
    if (!hookSuccess) {
      return bytes4(0);
    }

    bool validationSuccess = _handleValidation(validator, _signedHash, signature);
    return validationSuccess ? ACCOUNT_VALIDATION_SUCCESS_MAGIC : bytes4(0);
  }

  /// @dev Increments the nonce value in Nonce Holder system contract to ensure replay attack protection.
  /// @dev Reverts if the Nonce Holder stores different `_nonce` value from the expected one.
  /// @param _expectedNonce The nonce value expected for the account to be stored in the Nonce Holder.
  function _incrementNonce(uint256 _expectedNonce) internal {
    SystemContractsCaller.systemCallWithPropagatedRevert(
      uint32(gasleft()),
      address(NONCE_HOLDER_SYSTEM_CONTRACT),
      0,
      abi.encodeCall(INonceHolder.incrementMinNonceIfEquals, (_expectedNonce))
    );
  }

  /// @dev Safely casts a uint256 to an address.
  /// @dev Revert if the value exceeds the maximum size for an address (160 bits).
  function _safeCastToAddress(uint256 _value) internal pure returns (address) {
    if (_value > type(uint160).max) revert();
    return address(uint160(_value));
  }
}
