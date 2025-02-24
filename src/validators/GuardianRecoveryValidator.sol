// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IGuardianRecoveryValidator } from "../interfaces/IGuardianRecoveryValidator.sol";
import { WebAuthValidator } from "./WebAuthValidator.sol";
import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import { IModule } from "../interfaces/IModule.sol";
import { TimestampAsserterLocator } from "../helpers/TimestampAsserterLocator.sol";
import { BatchCaller, Call } from "../batch/BatchCaller.sol";

contract GuardianRecoveryValidator is IGuardianRecoveryValidator {
  struct Guardian {
    address addr;
    bool isReady;
    uint64 addedAt;
  }

  struct RecoveryRequest {
    bytes32 hashedCredentialId;
    bytes32[2] rawPublicKey;
    string originDomain;
    uint256 timestamp;
  }

  error GuardianCannotBeSelf();
  error GuardianNotFound(address guardian);
  error GuardianNotProposed(address guardian);
  error PasskeyNotMatched();
  error CooldownPeriodNotPassed();
  error ExpiredRequest();

  event RecoveryInitiated(address indexed account, address indexed guardian, bytes32 indexed hashedCredentialId);
  event RecoveryFinished(address indexed account);
  event RecoveryDiscarded(address indexed account);

  uint256 constant REQUEST_VALIDITY_TIME = 72 * 60 * 60; // 72 hours
  uint256 constant REQUEST_DELAY_TIME = 24 * 60 * 60; // 24 hours

  mapping(address account => Guardian[]) public accountGuardians;
  mapping(address guardian => address[]) public guardedAccounts;
  mapping(address account => RecoveryRequest) public pendingRecoveryData;

  WebAuthValidator public immutable webAuthValidator;

  /// @notice The constructor sets the web authn validator for which recovery process can be initiated. Used only for non proxied deployment
  constructor(WebAuthValidator _webAuthValidator) {
    webAuthValidator = _webAuthValidator;
  }

  /// @notice Validator initiator for given sso account. This module does not support initialization on creation
  function onInstall(bytes calldata) external {}

  /// @notice Removes all past guardians when this module is disabled in a account
  function onUninstall(bytes calldata) external {
    Guardian[] storage guardians = accountGuardians[msg.sender];
    for (uint256 i = 0; i < guardians.length; i++) {
      address guardian = guardians[i].addr;

      address[] storage accounts = guardedAccounts[guardian];
      for (uint256 j = 0; j < accounts.length; j++) {
        if (accounts[j] == msg.sender) {
          // If found last account is moved to current position, and then
          // last element is removed from array.
          accounts[j] = accounts[accounts.length - 1];
          accounts.pop();
          break;
        }
      }
    }

    delete accountGuardians[msg.sender];
  }

  /// @notice The `proposeValidationKey` method handles the initial registration of guardians by:
  ///   1. Taking an external account address and store it as pending guardian
  ///   2. Enable `addValidationKey` to confirm this account
  /// @param newGuardian New Guardian's address
  function proposeValidationKey(address newGuardian) external {
    if (msg.sender == newGuardian) revert GuardianCannotBeSelf();

    Guardian[] storage guardians = accountGuardians[msg.sender];

    // If the guardian exist this method stops
    for (uint256 i = 0; i < guardians.length; i++) {
      if (guardians[i].addr == newGuardian) {
        return;
      }
    }

    guardians.push(Guardian(newGuardian, false, uint64(block.timestamp)));
  }

  /// @notice This method handles the removal of guardians by:
  ///   1. Accepting an address as input
  ///   2. Removing the account from the list of guardians
  /// @param guardianToRemove Guardian's address to remove
  function removeValidationKey(address guardianToRemove) external {
    Guardian[] storage guardians = accountGuardians[msg.sender];

    // Searchs guardian with given address
    for (uint256 i = 0; i < guardians.length; i++) {
      if (guardians[i].addr == guardianToRemove) {
        bool wasActiveGuardian = guardians[i].isReady;
        // If found last guardian is moved to current position, and then
        // last element is removed from array.
        guardians[i] = guardians[guardians.length - 1];
        guardians.pop();

        if (wasActiveGuardian) {
          address[] storage accounts = guardedAccounts[guardianToRemove];
          for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] == msg.sender) {
              // If found last account is moved to current position, and then
              // last element is removed from array.
              accounts[i] = accounts[accounts.length - 1];
              accounts.pop();
              break;
            }
          }
        }
        return;
      }
    }

    revert GuardianNotFound(guardianToRemove);
  }

  /// @notice This method allows to accept being a guardian of given account
  /// @param key Encoded address of account which msg.sender is becoming guardian of
  /// @return Flag indicating whether guardian was already valid or not
  function addValidationKey(bytes memory key) external returns (bool) {
    address accountToGuard = abi.decode(key, (address));
    Guardian[] storage guardians = accountGuardians[accountToGuard];

    // Searches if the caller is in the list of guardians.
    // If guardian found is set to true.
    for (uint256 i = 0; i < guardians.length; i++) {
      if (guardians[i].addr == msg.sender) {
        // We return true if the guardian was not confirmed before.
        if (guardians[i].isReady) return false;

        guardians[i].isReady = true;
        guardedAccounts[msg.sender].push(accountToGuard);
        return true;
      }
    }

    revert GuardianNotProposed(msg.sender);
  }

  /// @notice This modifier allows execution only by active guardian of account
  /// @param account Address of account for which we verify guardian existence
  modifier onlyGuardianOf(address account) {
    bool isGuardian = false;
    for (uint256 i = 0; i < accountGuardians[account].length; i++) {
      if (accountGuardians[account][i].addr == msg.sender && accountGuardians[account][i].isReady) {
        isGuardian = true;
        break;
      }
    }
    if (!isGuardian) revert GuardianNotFound(msg.sender);
    // Continue execution if called by guardian
    _;
  }

  /// @notice This method initializes a recovery process for a given account
  /// @param accountToRecover Address of account for which given recovery is initiated
  /// @param hashedCredentialId Hashed credential ID of the new passkey
  /// @param rawPublicKey Raw public key of the new passkey
  /// @param originDomain Origin domain of the new passkey
  function initRecovery(
    address accountToRecover,
    bytes32 hashedCredentialId,
    bytes32[2] memory rawPublicKey,
    string memory originDomain
  ) external onlyGuardianOf(accountToRecover) {
    pendingRecoveryData[accountToRecover] = RecoveryRequest(
      hashedCredentialId,
      rawPublicKey,
      originDomain,
      block.timestamp
    );
    emit RecoveryInitiated(accountToRecover, msg.sender, hashedCredentialId);
  }

  /// @notice This method allows to discard currently pending recovery
  function discardRecovery() external {
    _discardRecovery();
    emit RecoveryDiscarded(msg.sender);
  }

  /// @notice This method allows to finish currently pending recovery
  function finishRecovery() internal {
    _discardRecovery();
    emit RecoveryFinished(msg.sender);
  }

  /// @notice This method allows to discard currently pending recovery
  function _discardRecovery() internal {
    delete pendingRecoveryData[msg.sender];
  }

  /// @inheritdoc IModuleValidator
  function validateTransaction(bytes32, Transaction calldata transaction) external returns (bool) {
    // Finishing Recovery Process. If the user has a recovery in progress then:
    //   1. The method will check if the transaction is attempting to modify passkeys
    //   2. Verify the new passkey matches the one stored in `initRecovery`
    //   3. Allows anyone to call this method, as the recovery was already verified in `initRecovery`
    //   4. Verifies that the required timelock period has passed since `initRecovery` was called
    //   5. If all the above are true, the recovery is finished
    require(transaction.data.length >= 4, "Only function calls are supported");
    require(transaction.to <= type(uint160).max, "Overflow");

    // Verify the transaction is a call to WebAuthValidator contract
    address target = address(uint160(transaction.to));
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

    RecoveryRequest storage storedData = pendingRecoveryData[msg.sender];

    if (
      keccak256(credentialId) != storedData.hashedCredentialId ||
      rawPublicKey[0] != storedData.rawPublicKey[0] ||
      rawPublicKey[1] != storedData.rawPublicKey[1] ||
      keccak256(abi.encode(originDomain)) != keccak256(abi.encode(storedData.originDomain))
    ) {
      return false;
    }

    // Verify request is in valid time range
    TimestampAsserterLocator.locate().assertTimestampInRange(
      storedData.timestamp + REQUEST_DELAY_TIME,
      storedData.timestamp + REQUEST_VALIDITY_TIME
    );

    finishRecovery();
    return true;
  }

  /// @inheritdoc IModuleValidator
  function validateSignature(bytes32, bytes memory) external pure returns (bool) {
    return false;
  }

  /// @inheritdoc IERC165
  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return
      interfaceId == type(IERC165).interfaceId ||
      interfaceId == type(IModuleValidator).interfaceId ||
      interfaceId == type(IModule).interfaceId;
  }

  /// @notice Returns all guardians for an account
  /// @param addr Address of account to get guardians for
  /// @return Array of guardians for the account
  function guardiansFor(address addr) public view returns (Guardian[] memory) {
    return accountGuardians[addr];
  }

  /// @notice Returns all accounts guarded by a guardian
  /// @param guardian Address of guardian to get guarded accounts for
  /// @return Array of accounts guarded by the guardian
  function guardianOf(address guardian) public view returns (address[] memory) {
    return guardedAccounts[guardian];
  }
}
