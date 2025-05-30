// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IModuleValidator } from "./IModuleValidator.sol";
import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";

interface IOidcRecoveryValidator is IModuleValidator {
  /// @notice Emitted when an SSO account updates their associated OIDC account.
  /// @param account The address of the SSO account that updated their OIDC data.
  /// @param oidcDigest Digest generated from data that identifies the user. Calculated as: PoseidonHash(sub || aud || iss || salt).
  /// @param iss The OIDC issuer.
  /// @param isNew True if the OIDC key is new, false if it is an update.
  event OidcAccountUpdated(address indexed account, bytes32 oidcDigest, string iss, bool isNew);

  /// @notice Emitted when an OIDC account is deleted.
  /// @param account The address of the SSO account that deleted the associated OIDC data.
  /// @param oidcDigest The PoseidonHash(sub || aud || iss || salt) of the OIDC key.
  event OidcAccountDeleted(address indexed account, bytes32 oidcDigest);

  /// @notice Emitted when a recovery process is started for an account.
  /// @param initiator The address that initiated the recovery process.
  /// @param targetAccount The address of the account being recovered.
  /// @param pendingPasskeyHash The hash of the pending passkey to be added.
  event RecoveryStarted(address indexed initiator, address indexed targetAccount, bytes32 pendingPasskeyHash);

  /// @notice Emitted when an ongoing recovery process is cancelled for an account.
  /// @param targetAccount The address of the account that cancelled the recovery.
  /// @param pendingPasskeyHash The passkey hash used in the cancelled recovery attempt.
  event RecoveryCancelled(address indexed targetAccount, bytes32 pendingPasskeyHash);

  /// @notice The data for an OIDC account.
  /// @param oidcDigest Digest that identifies an account. It's calculated as: PoseidonHash(sub || aud || iss || salt) of the OIDC key.
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
    uint256 recoveryStartedAt;
    uint256 recoverNonce;
    uint256 addedOn;
  }

  /// @notice Data needed to associate a new oidc account to an sso account.
  /// @param oidcDigest The PoseidonHash(sub || aud || iss || salt) of the OIDC key.
  /// @param iss The OIDC issuer. See https://openid.net/specs/openid-connect-core-1_0.html#IDToken
  struct OidcCreationData {
    bytes32 oidcDigest;
    string iss;
  }

  /// @notice The data for a zk proof. pB is expected to be already in the order needed for the verifier.
  struct ZkProof {
    uint256[2] pA;
    uint256[2][2] pB;
    uint256[2] pC;
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

  function addOidcAccount(bytes32 oidcDigest, string memory iss) external;
  function deleteOidcAccount() external;
  function startRecovery(StartRecoveryData calldata data, address targetAccount) external;
  function cancelRecovery() external;
  function addressForDigest(bytes32 digest) external returns (address);
  function oidcDataForAddress(address account) external returns (OidcData memory);
}
