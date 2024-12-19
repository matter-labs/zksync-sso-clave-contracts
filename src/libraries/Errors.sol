// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library Errors {
  /*//////////////////////////////////////////////////////////////
                               ACCOUNT
    //////////////////////////////////////////////////////////////*/

  error INSUFFICIENT_FUNDS(uint256 required, uint256 available);
  error FEE_PAYMENT_FAILED();
  error METHOD_NOT_IMPLEMENTED();

  /*//////////////////////////////////////////////////////////////
                               LINKED LIST
    //////////////////////////////////////////////////////////////*/

  error INVALID_PREV_BYTES(bytes prevValue, bytes oldValue);
  error INVALID_PREV_ADDR(address prevValue, address oldValue);
  // Bytes
  error INVALID_BYTES(uint256 length);
  error BYTES_ALREADY_EXISTS(bytes length);
  error BYTES_NOT_EXISTS(bytes lookup);
  // Address
  error INVALID_ADDRESS(address valid);
  error ADDRESS_ALREADY_EXISTS(address exists);
  error ADDRESS_NOT_EXISTS(address notExists);

  /*//////////////////////////////////////////////////////////////
                             VALIDATOR MANAGER
    //////////////////////////////////////////////////////////////*/

  error VALIDATOR_ERC165_FAIL(address validator);

  /*//////////////////////////////////////////////////////////////
                              HOOK MANAGER
    //////////////////////////////////////////////////////////////*/

  error EMPTY_HOOK_ADDRESS(uint256 hookAndDataLength);
  error HOOK_ERC165_FAIL(address hookAddress, bool isValidation);
  error INVALID_KEY(bytes32 key);

  /*//////////////////////////////////////////////////////////////
                              AUTH
    //////////////////////////////////////////////////////////////*/

  error NOT_FROM_BOOTLOADER(address notBootloader);
  error NOT_FROM_HOOK(address notHook);
  error NOT_FROM_SELF(address notSelf);

  /*//////////////////////////////////////////////////////////////
                            BatchCaller
    //////////////////////////////////////////////////////////////*/

  error CALL_FAILED(uint256 batchCallIndex);
  error MSG_VALUE_MISMATCH(uint256 actualValue, uint256 expectedValue);
}
