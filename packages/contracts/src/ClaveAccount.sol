// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { IAccount, ACCOUNT_VALIDATION_SUCCESS_MAGIC } from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IAccount.sol";
import { Transaction, TransactionHelper } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { EfficientCall } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/EfficientCall.sol";
import { NONCE_HOLDER_SYSTEM_CONTRACT, DEPLOYER_SYSTEM_CONTRACT, INonceHolder } from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import { SystemContractsCaller } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";
import { Utils } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/Utils.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import { HookManager } from "./managers/HookManager.sol";
import { ModuleManager } from "./managers/ModuleManager.sol";
import { UpgradeManager } from "./managers/UpgradeManager.sol";

import { TokenCallbackHandler, IERC165 } from "./helpers/TokenCallbackHandler.sol";

import { Errors } from "./libraries/Errors.sol";
import { SignatureDecoder } from "./libraries/SignatureDecoder.sol";
import { ModeCode } from "./libraries/ERC7579Mode.sol";

import { ERC1271Handler } from "./handlers/ERC1271Handler.sol";
import { Call } from "./batch/BatchCaller.sol";

import { MODULE_TYPE_VALIDATOR, MODULE_TYPE_EXECUTOR, MODULE_TYPE_FALLBACK, MODULE_TYPE_HOOK } from "./interfaces/IERC7579Module.sol";
import { IClaveAccount } from "./interfaces/IClaveAccount.sol";
import { IModule } from "./interfaces/IModule.sol";

import "hardhat/console.sol";

/**
 * @title Main account contract from the Clave wallet infrastructure in ZKsync Era
 * @author https://getclave.io
 */
contract ClaveAccount is
  Initializable,
  UpgradeManager,
  HookManager,
  ModuleManager,
  ERC1271Handler,
  TokenCallbackHandler,
  IClaveAccount
{
  // Helper library for the Transaction struct
  using TransactionHelper for Transaction;
  /** Removing batch call functionality to simplify setup
    TODO: Consider inlining this batch contract to avoid construction dependency
    // Batch transaction helper contract
    address private immutable _BATCH_CALLER;
     */

  /**
   * @notice Constructor for the account implementation
   */
  constructor() {
    // address batchCaller
    _disableInitializers();
  }

  /**
   * @notice Initializer function for the account contract
   * @dev Sets passkey and passkey validator within account storage
   * @param initialTypedModules bytes[] - Modules that declare a type and init data
   */
  function initialize(bytes[] calldata initialTypedModules) external initializer {
    for (uint256 moduleIndex = 0; moduleIndex < initialTypedModules.length; moduleIndex++) {
      (address moduleAddress, bytes memory moduleData) = abi.decode(initialTypedModules[moduleIndex], (address, bytes));
      if (IModule(moduleAddress).isInitialized(address(this))) {
        continue;
      }

      // NB: this validation is the only part that's not part of the module manager because clave splits validation
      // from other module types, so this remains at the top level account
      if (IModule(moduleAddress).isModuleType(MODULE_TYPE_VALIDATOR)) {
        _addModuleValidator(moduleAddress, moduleData);
      }

      // this is the callback type module that grants permissions to another contract
      if (IModule(moduleAddress).isModuleType(MODULE_TYPE_EXECUTOR)) {
        _addExternalExecutorPermission(moduleAddress, moduleData);
      }

      if (IModule(moduleAddress).isModuleType(MODULE_TYPE_FALLBACK)) {
        _addFallbackModule(moduleAddress, moduleData);
      }

      // these are execution hooks, not validation hooks
      if (IModule(moduleAddress).isModuleType(MODULE_TYPE_HOOK)) {
        // TODO: add native hook interface
        _addNativeModule(moduleAddress, moduleData);
      }
    }
  }

  // Receive function to allow ETHs
  receive() external payable {}

  /**
   * @notice Called by the bootloader to validate that an account agrees to process the transaction
   * (and potentially pay for it).
   * @dev The developer should strive to preserve as many steps as possible both for valid
   * and invalid transactions as this very method is also used during the gas fee estimation
   * (without some of the necessary data, e.g. signature).
   * @param - bytes32                        - Not used
   * @param suggestedSignedHash bytes32      - The suggested hash of the transaction that is signed by the signer
   * @param transaction Transaction calldata - The transaction itself
   * @return magic bytes4 - The magic value that should be equal to the signature of this function
   * if the user agrees to proceed with the transaction.
   */
  function validateTransaction(
    bytes32,
    bytes32 suggestedSignedHash,
    Transaction calldata transaction
  ) external payable override onlyBootloader returns (bytes4 magic) {
    _incrementNonce(transaction.nonce);

    // The fact there is enough balance for the account
    // should be checked explicitly to prevent user paying for fee for a
    // transaction that wouldn't be included on Ethereum.
    if (transaction.totalRequiredBalance() > address(this).balance) {
      revert Errors.INSUFFICIENT_FUNDS();
    }

    // While the suggested signed hash is usually provided, it is generally
    // not recommended to rely on it to be present, since in the future
    // there may be tx types with no suggested signed hash.
    bytes32 signedHash = suggestedSignedHash == bytes32(0)
      ? transaction.encodeHash() // TODO: this hash needs to depend on the signature type?
      : suggestedSignedHash;

    magic = _validateTransaction(signedHash, transaction);
  }

  /**
   * @notice Called by the bootloader to make the account execute the transaction.
   * @dev The transaction is considered successful if this function does not revert
   * @param - bytes32                        - Not used
   * @param - bytes32                        - Not used
   * @param transaction Transaction calldata - The transaction itself
   */
  function executeTransaction(
    bytes32,
    bytes32,
    Transaction calldata transaction
  ) external payable override onlyBootloader {
    _executeTransaction(transaction);
  }

  /**
   * @notice This function allows the account to pay for its own gas and used when there is no paymaster
   * @param - bytes32                        - not used
   * @param - bytes32                        - not used
   * @param transaction Transaction calldata - Transaction to pay for
   * @dev "This method must send at least `tx.gasprice * tx.gasLimit` ETH to the bootloader address."
   */
  function payForTransaction(
    bytes32,
    bytes32,
    Transaction calldata transaction
  ) external payable override onlyBootloader {
    bool success = transaction.payToTheBootloader();

    if (!success) {
      revert Errors.FEE_PAYMENT_FAILED();
    }

    emit FeePaid();
  }

  /**
     * @notice This function is called by the system if the transaction has a paymaster
        and prepares the interaction with the paymaster
     * @param - bytes32               - not used
     * @param - bytes32               - not used
     * @param transaction Transaction - The transaction itself
     */
  function prepareForPaymaster(
    bytes32,
    bytes32,
    Transaction calldata transaction
  ) external payable override onlyBootloader {
    transaction.processPaymasterInput();
  }

  /// @dev type(IClave).interfaceId indicates Clave accounts
  function supportsInterface(bytes4 interfaceId) public view override(IERC165, TokenCallbackHandler) returns (bool) {
    return interfaceId == type(IClaveAccount).interfaceId || super.supportsInterface(interfaceId);
  }

  function _validateTransaction(
    bytes32 signedHash,
    Transaction calldata transaction
  ) internal returns (bytes4 magicValue) {
    if (transaction.signature.length == 65) {
      // This is a gas estimation
      return bytes4(0);
    }

    // Extract the signature, validator address and hook data from the transaction.signature
    (bytes memory signature, address validator, bytes[] memory hookData) = SignatureDecoder.decodeSignature(
      transaction.signature
    );

    console.log("validator address");
    console.logAddress(validator);

    // Run validation hooks
    bool hookSuccess = runValidationHooks(signedHash, transaction, hookData);
    if (!hookSuccess) {
      console.log("failed hook validation");
      return bytes4(0);
    }

    bool valid = _handleValidation(validator, signedHash, signature);

    magicValue = valid ? ACCOUNT_VALIDATION_SUCCESS_MAGIC : bytes4(0);
  }

  function _executeTransaction(Transaction calldata transaction) internal runExecutionHooks(transaction) {
    address to = _safeCastToAddress(transaction.to);
    uint128 value = Utils.safeCastToU128(transaction.value);
    bytes calldata data = transaction.data;

    _executeCall(to, value, data, false);
  }

  function _executeCall(address to, uint128 value, bytes calldata data, bool allowFailure) internal {
    uint32 gas = Utils.safeCastToU32(gasleft());

    if (to == address(DEPLOYER_SYSTEM_CONTRACT)) {
      // Note, that the deployer contract can only be called
      // with a "systemCall" flag.
      (bool success, bytes memory returnData) = SystemContractsCaller.systemCallWithReturndata(gas, to, value, data);
      if (!success && !allowFailure) {
        assembly {
          let size := mload(returnData)
          revert(add(returnData, 0x20), size)
        }
      }
    }
    /** FIXME: batch calling support
        else if (to == _BATCH_CALLER) {
            bool success = EfficientCall.rawDelegateCall(gas, to, data);
            if (!success && !allowFailure) {
                EfficientCall.propagateRevert();
            }
        }
        */
    else {
      bool success = EfficientCall.rawCall(gas, to, value, data, false);
      if (!success && !allowFailure) {
        EfficientCall.propagateRevert();
      }
    }
  }

  function _incrementNonce(uint256 nonce) internal {
    SystemContractsCaller.systemCallWithPropagatedRevert(
      uint32(gasleft()),
      address(NONCE_HOLDER_SYSTEM_CONTRACT),
      0,
      abi.encodeCall(INonceHolder.incrementMinNonceIfEquals, (nonce))
    );
  }

  function _safeCastToAddress(uint256 value) internal pure returns (address) {
    if (value > type(uint160).max) revert();
    return address(uint160(value));
  }
}
