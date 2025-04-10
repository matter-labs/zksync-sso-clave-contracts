// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { EnumerableSetUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import { WebAuthValidator } from "./WebAuthValidator.sol";
import { IGuardianRecoveryValidator } from "../interfaces/IGuardianRecoveryValidator.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import { IModule } from "../interfaces/IModule.sol";
import { IValidatorManager } from "../interfaces/IValidatorManager.sol";
import { TimestampAsserterLocator } from "../helpers/TimestampAsserterLocator.sol";
import { Utils } from "../helpers/Utils.sol";

/// @title GuardianRecoveryValidator
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev This contract allows account recovery using trusted guardians.
contract GuardianRecoveryValidator is Initializable, IGuardianRecoveryValidator {
  using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
  using EnumerableSetUpgradeable for EnumerableSetUpgradeable.Bytes32Set;

  uint256 public constant REQUEST_VALIDITY_TIME = 72 * 60 * 60; // 72 hours
  uint256 public constant REQUEST_DELAY_TIME = 24 * 60 * 60; // 24 hours

  bytes30 private _gap; // Gap to claim 30 bytes remaining in slot 0 after fields layout of Initializable contract
  WebAuthValidator public webAuthValidator; // Enforced slot 1 in order to be able to access it during validateTransaction step
  mapping(bytes32 hashedOriginDomain => mapping(address account => EnumerableSetUpgradeable.AddressSet guardians))
    private accountGuardians;
  mapping(bytes32 hashedOriginDomain => mapping(address guardian => EnumerableSetUpgradeable.AddressSet accounts))
    private guardedAccounts;
  mapping(address account => EnumerableSetUpgradeable.Bytes32Set hashedOriginDomains)
    private accountHashedOriginDomains;
  mapping(bytes32 hashedOriginDomain => mapping(address account => RecoveryRequest recoveryData))
    private pendingRecoveryData;
  mapping(bytes32 hashedOriginDomain => mapping(address account => mapping(address guardian => Guardian guardianData)))
    public accountGuardianData;

  /// @notice This modifier allows execution only by active guardian of account
  /// @param hashedOriginDomain Hash of origin domain
  /// @param account Address of account for which we verify guardian existence
  modifier onlyGuardianOf(bytes32 hashedOriginDomain, address account) {
    bool isGuardian = accountGuardians[hashedOriginDomain][account].contains(msg.sender) &&
      accountGuardianData[hashedOriginDomain][account][msg.sender].isReady;

    if (!isGuardian) revert GuardianNotFound(msg.sender);
    // Continue execution if called by guardian
    _;
  }

  constructor() {
    _disableInitializers();
  }

  function initialize(WebAuthValidator _webAuthValidator) external initializer {
    if (address(_webAuthValidator) == address(0)) revert InvalidWebAuthValidatorAddress();
    webAuthValidator = _webAuthValidator;
  }

  /// @notice Validator initiator for given sso account.
  /// @dev This module does not support initialization on creation,
  /// but ensures that the WebAuthValidator is enabled for calling SsoAccount.
  /// @inheritdoc IModule
  function onInstall(bytes calldata) external {
    if (!IValidatorManager(msg.sender).isModuleValidator(address(webAuthValidator))) {
      revert WebAuthValidatorNotEnabled();
    }
  }

  /// @notice Removes all past guardians when this module is disabled in a account
  /// @inheritdoc IModule
  function onUninstall(bytes calldata) external {
    bytes32[] memory hashedOriginDomains = accountHashedOriginDomains[msg.sender].values();
    for (uint256 j = 0; j < hashedOriginDomains.length; ++j) {
      bytes32 hashedOriginDomain = hashedOriginDomains[j];
      address[] memory guardians = accountGuardians[hashedOriginDomain][msg.sender].values();
      for (uint256 i = 0; i < guardians.length; ++i) {
        address guardian = guardians[i];

        bool wasActiveGuardian = accountGuardianData[hashedOriginDomain][msg.sender][guardian].isReady;
        if (wasActiveGuardian) {
          EnumerableSetUpgradeable.AddressSet storage accounts = guardedAccounts[hashedOriginDomain][guardian];
          bool guardedAccountsRemovalSuccessful = accounts.remove(msg.sender);

          if (!guardedAccountsRemovalSuccessful) {
            revert AccountNotGuardedByAddress(msg.sender, guardian);
          }
        }

        delete accountGuardianData[hashedOriginDomain][msg.sender][guardian];

        bool removalSuccessful = accountGuardians[hashedOriginDomain][msg.sender].remove(guardian);

        if (!removalSuccessful) {
          revert GuardianNotFound(guardian);
        }

        emit GuardianRemoved(msg.sender, hashedOriginDomain, guardian);
      }

      // Allow-listing slither finding as the element removal's success is granted due to the element being
      //  loaded from the accountHashedOriginDomains EnumerableSet on line 74
      // slither-disable-next-line unused-return
      accountHashedOriginDomains[msg.sender].remove(hashedOriginDomain);

      // Remove pending recovery data if exist
      if (pendingRecoveryData[hashedOriginDomain][msg.sender].timestamp != 0) {
        discardRecovery(hashedOriginDomain);
      }
    }
  }

  function proposeGuardian(bytes32 hashedOriginDomain, address newGuardian) external {
    if (msg.sender == newGuardian) revert GuardianCannotBeSelf();
    if (newGuardian == address(0)) revert InvalidGuardianAddress();

    bool additionSuccessful = accountGuardians[hashedOriginDomain][msg.sender].add(newGuardian);

    if (!additionSuccessful) {
      return;
    }

    accountGuardianData[hashedOriginDomain][msg.sender][newGuardian] = Guardian(
      newGuardian,
      false,
      uint64(block.timestamp)
    );

    if (accountHashedOriginDomains[msg.sender].add(hashedOriginDomain)) {
      emit HashedOriginDomainEnabledForAccount(msg.sender, hashedOriginDomain);
    }

    emit GuardianProposed(msg.sender, hashedOriginDomain, newGuardian);
  }

  function removeGuardian(bytes32 hashedOriginDomain, address guardianToRemove) external {
    if (guardianToRemove == address(0)) revert InvalidGuardianAddress();

    bool removalSuccessful = accountGuardians[hashedOriginDomain][msg.sender].remove(guardianToRemove);
    if (!removalSuccessful) {
      revert GuardianNotFound(guardianToRemove);
    }

    bool wasActiveGuardian = accountGuardianData[hashedOriginDomain][msg.sender][guardianToRemove].isReady;
    delete accountGuardianData[hashedOriginDomain][msg.sender][guardianToRemove];

    if (wasActiveGuardian) {
      EnumerableSetUpgradeable.AddressSet storage accounts = guardedAccounts[hashedOriginDomain][guardianToRemove];
      bool accountsRemovalSuccessful = accounts.remove(msg.sender);

      if (!accountsRemovalSuccessful) {
        revert AccountNotGuardedByAddress(msg.sender, guardianToRemove);
      }
    }

    if (accountGuardians[hashedOriginDomain][msg.sender].length() == 0) {
      if (!accountHashedOriginDomains[msg.sender].remove(hashedOriginDomain)) {
        revert UnknownHashedOriginDomain(hashedOriginDomain);
      } else {
        emit HashedOriginDomainDisabledForAccount(msg.sender, hashedOriginDomain);
      }
    }

    emit GuardianRemoved(msg.sender, hashedOriginDomain, guardianToRemove);
    return;
  }

  function addGuardian(bytes32 hashedOriginDomain, address accountToGuard) external returns (bool) {
    if (accountToGuard == address(0)) revert InvalidAccountToGuardAddress();

    bool guardianProposed = accountGuardians[hashedOriginDomain][accountToGuard].contains(msg.sender);
    if (!guardianProposed) {
      revert GuardianNotProposed(msg.sender);
    }

    // We return true if the guardian was not confirmed before.
    if (accountGuardianData[hashedOriginDomain][accountToGuard][msg.sender].isReady) return false;

    accountGuardianData[hashedOriginDomain][accountToGuard][msg.sender].isReady = true;
    bool addSuccessful = guardedAccounts[hashedOriginDomain][msg.sender].add(accountToGuard);

    if (!addSuccessful) {
      revert AccountAlreadyGuardedByGuardian(accountToGuard, msg.sender);
    }

    emit GuardianAdded(accountToGuard, hashedOriginDomain, msg.sender);
    return true;
  }

  function initRecovery(
    address accountToRecover,
    bytes32 hashedCredentialId,
    bytes32[2] calldata rawPublicKey,
    bytes32 hashedOriginDomain
  ) external onlyGuardianOf(hashedOriginDomain, accountToRecover) {
    if (accountToRecover == address(0)) revert InvalidAccountToRecoverAddress();

    if (pendingRecoveryData[hashedOriginDomain][accountToRecover].timestamp + REQUEST_VALIDITY_TIME > block.timestamp) {
      revert AccountRecoveryInProgress();
    }

    pendingRecoveryData[hashedOriginDomain][accountToRecover] = RecoveryRequest(
      hashedCredentialId,
      rawPublicKey,
      uint64(block.timestamp)
    );

    emit RecoveryInitiated(accountToRecover, hashedOriginDomain, hashedCredentialId, msg.sender);
  }

  function discardRecovery(bytes32 hashedOriginDomain) public {
    emit RecoveryDiscarded(
      msg.sender,
      hashedOriginDomain,
      pendingRecoveryData[hashedOriginDomain][msg.sender].hashedCredentialId
    );
    _discardRecovery(hashedOriginDomain);
  }

  /// @inheritdoc IModuleValidator
  function validateTransaction(bytes32, Transaction calldata transaction) external returns (bool) {
    // Finishing Recovery Process. If the user has a recovery in progress then:
    //   1. The method will check if the transaction is attempting to modify passkeys
    //   2. Verify the new passkey matches the one stored in `initRecovery`
    //   3. Allows anyone to call this method, as the recovery was already verified in `initRecovery`
    //   4. Verifies that the required timelock period has passed since `initRecovery` was called
    //   5. If all the above are true, the recovery is finished
    if (transaction.data.length < 4) {
      revert NonFunctionCallTransaction();
    }

    // Verify the transaction is a call to WebAuthValidator contract
    address target = Utils.safeCastToAddress(transaction.to);
    if (target != address(webAuthValidator)) {
      return false;
    }

    // Verify the transaction is a call to `addValidationKey`
    bytes4 selector = bytes4(transaction.data[:4]);
    if (selector != WebAuthValidator.addValidationKey.selector) {
      return false;
    }

    // Verify the current request matches pending one
    bytes calldata transactionData = transaction.data[4:];
    (bytes memory credentialId, bytes32[2] memory rawPublicKey, string memory originDomain) = abi.decode(
      transactionData,
      (bytes, bytes32[2], string)
    );

    bytes32 hashedOriginDomain = keccak256(abi.encodePacked(originDomain));
    RecoveryRequest storage storedData = pendingRecoveryData[hashedOriginDomain][msg.sender];

    bytes32 hashedCredentialIdFromTx = keccak256(credentialId);
    if (hashedCredentialIdFromTx != storedData.hashedCredentialId) {
      return false;
    }

    if (rawPublicKey[0] != storedData.rawPublicKey[0] || rawPublicKey[1] != storedData.rawPublicKey[1]) {
      return false;
    }
    // Verify request is in valid time range
    TimestampAsserterLocator.locate().assertTimestampInRange(
      storedData.timestamp + REQUEST_DELAY_TIME,
      storedData.timestamp + REQUEST_VALIDITY_TIME
    );

    _finishRecovery(hashedOriginDomain);
    return true;
  }

  /// @inheritdoc IModuleValidator
  function validateSignature(bytes32, bytes calldata) external pure returns (bool) {
    return false;
  }

  /// @inheritdoc IERC165
  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return
      interfaceId == type(IERC165).interfaceId ||
      interfaceId == type(IModuleValidator).interfaceId ||
      interfaceId == type(IModule).interfaceId ||
      interfaceId == type(IGuardianRecoveryValidator).interfaceId;
  }

  function guardiansFor(bytes32 hashedOriginDomain, address addr) external view returns (Guardian[] memory) {
    address[] memory guardians = accountGuardians[hashedOriginDomain][addr].values();
    Guardian[] memory result = new Guardian[](guardians.length);
    for (uint256 i = 0; i < guardians.length; ++i) {
      result[i] = accountGuardianData[hashedOriginDomain][addr][guardians[i]];
    }
    return result;
  }

  function guardianOf(bytes32 hashedOriginDomain, address guardian) external view returns (address[] memory) {
    return guardedAccounts[hashedOriginDomain][guardian].values();
  }

  function getPendingRecoveryData(
    bytes32 hashedOriginDomain,
    address account
  ) external view returns (RecoveryRequest memory) {
    return pendingRecoveryData[hashedOriginDomain][account];
  }

  /// @notice This method allows to finish currently pending recovery
  /// @param hashedOriginDomain Hash of origin domain
  function _finishRecovery(bytes32 hashedOriginDomain) internal {
    emit RecoveryFinished(
      msg.sender,
      hashedOriginDomain,
      pendingRecoveryData[hashedOriginDomain][msg.sender].hashedCredentialId
    );
    _discardRecovery(hashedOriginDomain);
  }

  /// @notice This method allows to discard currently pending recovery
  /// @param hashedOriginDomain Hash of origin domain
  function _discardRecovery(bytes32 hashedOriginDomain) internal {
    delete pendingRecoveryData[hashedOriginDomain][msg.sender];
  }
}
