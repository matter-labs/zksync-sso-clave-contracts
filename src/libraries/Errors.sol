// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @title Errors
/// @notice Errors used by ZKsync SSO and its components
/// @author Initial version by getclave.io, modified by Matter Labs
library Errors {
  // Account errors
  error INSUFFICIENT_FUNDS(uint256 required, uint256 available);
  error FEE_PAYMENT_FAILED();
  error ACCOUNT_ALREADY_EXISTS(address account);
  error INVALID_ACCOUNT_KEYS();
  error METHOD_NOT_IMPLEMENTED();

  // ERC165 module errors
  error VALIDATOR_ERC165_FAIL(address validator);
  error HOOK_ERC165_FAIL(address hookAddress, bool isValidation);

  // Auth errors
  error NOT_FROM_BOOTLOADER(address notBootloader);
  error NOT_FROM_SELF(address notSelf);
  error NOT_FROM_INITIALIZED_ACCOUNT(address notInitialized);

  // Manager errors
  error OWNER_ALREADY_EXISTS(address owner);
  error OWNER_NOT_FOUND(address owner);
  error VALIDATOR_ALREADY_EXISTS(address validator);
  error VALIDATOR_NOT_FOUND(address validator);
  error HOOK_ALREADY_EXISTS(address hook, bool isValidation);
  error HOOK_NOT_FOUND(address hook, bool isValidation);

  // Sessions errors
  error SESSION_ZERO_SIGNER();
  error SESSION_INVALID_SIGNER(address recovered, address expected);
  error SESSION_ALREADY_EXISTS(bytes32 sessionHash);
  error SESSION_UNLIMITED_FEES();
  error SESSION_EXPIRES_TOO_SOON(uint256 expiresAt);
  error SESSION_NOT_ACTIVE();
  error SESSION_LIFETIME_USAGE_EXCEEDED(uint256 lifetimeUsage, uint256 maxUsage);
  error SESSION_ALLOWANCE_EXCEEDED(uint256 allowance, uint256 maxAllowance, uint64 period);
  error SESSION_INVALID_DATA_LENGTH(uint256 actualLength, uint256 expectedMinimumLength);
  error SESSION_CONDITION_FAILED(bytes32 param, bytes32 refValue, uint8 condition);
  error SESSION_CALL_POLICY_VIOLATED(address target, bytes4 selector);
  error SESSION_TRANSFER_POLICY_VIOLATED(address target);
  error SESSION_MAX_VALUE_EXCEEDED(uint256 usedValue, uint256 maxValuePerUse);
  error SESSION_SIGNER_USED(address signer);
  error SESSION_CALL_POLICY_BANNED(address target, bytes4 selector);
  error SESSION_ACTIONS_NOT_ALLOWED(bytes32 sessionActionsHash);

  // WebAuthn errors
  error WEBAUTHN_NOT_KEY_OWNER(address account);
  error WEBAUTHN_KEY_EXISTS();
  error WEBAUTHN_ACCOUNT_EXISTS();
  error WEBAUTHN_EMPTY_KEY();
  error WEBAUTHN_BAD_DOMAIN_LENGTH();
  error WEBAUTHN_BAD_CREDENTIAL_ID_LENGTH();

  // Misc
  error MSG_VALUE_MISMATCH(uint256 actualValue, uint256 expectedValue);
  error NO_TIMESTAMP_ASSERTER(uint256 chainId);
  error ADDRESS_CAST_OVERFLOW(uint256 value);
  error INVALID_PAYMASTER_INPUT(bytes input);
  error WEBAUTH_VALIDATOR_NOT_INSTALLED();

  // Guardians errors
  error GUARDIAN_CANNOT_BE_SELF();
  error GUARDIAN_NOT_FOUND(address guardian);
  error GUARDIAN_NOT_PROPOSED(address guardian);
  error ACCOUNT_ALREADY_GUARDED(address account, address guardian);
  error ACCOUNT_NOT_GUARDED_BY_ADDRESS(address account, address guardian);
  error GUARDIAN_RECOVERY_IN_PROGRESS();
  error GUARDIAN_INVALID_ADDRESS();
  error GUARDIAN_INVALID_WEBAUTH_VALIDATOR();
  error GUARDIAN_INVALID_ACCOUNT();
  error GUARDIAN_INVALID_RECOVERY_CALL();
  error GUARDIAN_UNKNOWN_DOMAIN(bytes32 hashedOriginDomain);

  // OIDC errors
  error OIDC_KEY_NOT_FOUND(bytes32 issuerHash, bytes32 kid);
  error OIDC_KEY_COUNT_LIMIT_EXCEEDED(uint256 count);
  error OIDC_ISSUER_HASH_MISMATCH(bytes32 expectedIssuerHash, bytes32 actualIssuerHash);
  error OIDC_ZERO_KEY_ID(uint256 index);
  error OIDC_ZERO_MODULUS(bytes32 kid);
  error OIDC_MODULUS_CHUNK_TOO_LARGE(bytes32 kid, uint256 chunkIndex, uint256 chunkValue);
  error OIDC_EVEN_RSA_MODULUS(bytes32 kid);
  error OIDC_KEY_ID_ALREADY_EXISTS(bytes32 kid, bytes32 issuerHash);

  error OIDC_ADDRESS_NOT_FOUND(bytes32 digest);
  error OIDC_DIGEST_TAKEN(address currentAccount);
  error OIDC_NO_DATA_FOR_ACCOUNT(address account);
  error OIDC_ZKP_VERIFICATION_FAILED();
  error OIDC_TIME_LIMIT_EXPIRED();
  error OIDC_ZERO_KEY_REGISTRY();
  error OIDC_ZERO_VERIFIER();
  error OIDC_ZERO_WEBAUTH_VALIDATOR();
  error OIDC_EMPTY_DIGEST();
  error OIDC_EMPTY_ISSUER();
  error OIDC_ISSUER_TOO_LONG();
  error OIDC_NO_RECOVERY_STARTED();
}
