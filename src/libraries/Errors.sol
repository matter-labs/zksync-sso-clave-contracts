// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library Errors {
  // Account errors
  error INSUFFICIENT_FUNDS(uint256 required, uint256 available);
  error FEE_PAYMENT_FAILED();
  error METHOD_NOT_IMPLEMENTED();

  // Validator manager errors
  error VALIDATOR_ERC165_FAIL(address validator);

  // Hook manager errors
  error EMPTY_HOOK_ADDRESS(uint256 hookAndDataLength);
  error HOOK_ERC165_FAIL(address hookAddress, bool isValidation);
  error INVALID_KEY(bytes32 key);

  // Auth errors
  error NOT_FROM_BOOTLOADER(address notBootloader);
  error NOT_FROM_HOOK(address notHook);
  error NOT_FROM_SELF(address notSelf);

  // Batch caller errors
  error CALL_FAILED(uint256 batchCallIndex);
  error MSG_VALUE_MISMATCH(uint256 actualValue, uint256 expectedValue);
}
