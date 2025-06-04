// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { EfficientCall } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/EfficientCall.sol";
import { Utils } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/Utils.sol";
import { IPaymasterFlow } from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { DEPLOYER_SYSTEM_CONTRACT } from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import { Errors } from "../libraries/Errors.sol";

/// @title Utility functions
/// @dev Utility functions used in ZKsync SSO contracts
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
library SsoUtils {
  /// @dev Safely casts a uint256 to an address.
  /// @dev Revert if the value exceeds the maximum size for an address (160 bits).
  /// @param _value The uint256 value to be casted to an address.
  /// @return The address representation of the input value.
  function safeCastToAddress(uint256 _value) internal pure returns (address) {
    if (_value > type(uint160).max) {
      revert Errors.ADDRESS_CAST_OVERFLOW(_value);
    }
    return address(uint160(_value));
  }

  /// @dev Decode transaction.signature into signature, validator and validator data
  /// @param txSignature The transaction signature field to decode (signature | validator | validatorData).
  /// @return signature The actual signature for the transaction.
  /// @return validator The address of the validator to be used for signature validation.
  /// @return validatorData Additional data provided for the validator.
  function decodeSignature(
    bytes calldata txSignature
  ) internal pure returns (bytes memory signature, address validator, bytes memory validatorData) {
    (signature, validator, validatorData) = abi.decode(txSignature, (bytes, address, bytes));
  }

  /// @dev Decode signature into signature and validator
  /// @param signatureAndValidator The transaction signature field to decode (signature | validator).
  /// @return signature The actual signature for the transaction.
  /// @return validator The address of the validator to be used for signature validation.
  function decodeSignatureNoValidatorData(
    bytes memory signatureAndValidator
  ) internal pure returns (bytes memory signature, address validator) {
    (signature, validator) = abi.decode(signatureAndValidator, (bytes, address));
  }

  /// @notice Perform a call to a specified address with given value and data.
  /// @dev This method correctly handles the case of contract deployment.
  /// @param _to The address to call.
  /// @param _value The value to send with the call.
  /// @param _data The calldata to send with the call.
  /// @return bool Returns true if the call was successful, false otherwise.
  function performCall(address _to, uint256 _value, bytes calldata _data) internal returns (bool) {
    uint32 gas = Utils.safeCastToU32(gasleft());

    if (_to == address(DEPLOYER_SYSTEM_CONTRACT) && _data.length >= 4) {
      bytes4 selector = bytes4(_data[:4]);
      // Check that called function is the deployment method,
      // the other deployer methods are not supposed to be called from the account.
      // NOTE: DefaultAccount has the same behavior.
      bool isSystemCall = selector == DEPLOYER_SYSTEM_CONTRACT.create.selector ||
        selector == DEPLOYER_SYSTEM_CONTRACT.create2.selector ||
        selector == DEPLOYER_SYSTEM_CONTRACT.createAccount.selector ||
        selector == DEPLOYER_SYSTEM_CONTRACT.create2Account.selector;
      // Note, that the deployer contract can only be called with a "isSystemCall" flag.
      return EfficientCall.rawCall({ _gas: gas, _address: _to, _value: _value, _data: _data, _isSystem: isSystemCall });
    } else {
      return EfficientCall.rawCall(gas, _to, _value, _data, false);
    }
  }

  /// @notice This method implements an ultra-efficient way for executing delegate calls.
  /// It is compatible with OpenZeppelin proxy implementations.
  /// @dev this method uses the EfficientCall library to forward calldata to the implementation contract,
  /// instead of copying it from calldata to memory.
  /// @param implementation The address of the implementation contract to delegate call.
  function delegate(address implementation) internal {
    bytes memory data = EfficientCall.delegateCall(gasleft(), implementation, msg.data);
    assembly {
      return(add(data, 0x20), mload(data))
    }
  }

  /// @notice Checks if the transaction is using an approval-based paymaster.
  /// @param transaction The transaction to check.
  /// @return bool Returns true if the transaction is using an approval-based paymaster, false otherwise.
  function usingApprovalBasedPaymaster(Transaction calldata transaction) internal pure returns (bool) {
    return
      transaction.paymaster != 0 &&
      transaction.paymasterInput.length >= 4 &&
      bytes4(transaction.paymasterInput[:4]) == IPaymasterFlow.approvalBased.selector;
  }
}
