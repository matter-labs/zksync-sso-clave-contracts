// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IGuardianRecoveryValidator } from "../interfaces/IGuardianRecoveryValidator.sol";
import { WebAuthValidator } from "./WebAuthValidator.sol";
import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import { IModule } from "../interfaces/IModule.sol";
import { SignatureDecoder } from "../libraries/SignatureDecoder.sol";

contract GuardianRecoveryValidator is Initializable, IGuardianRecoveryValidator {
  struct Guardian {
    address addr;
    bool isReady;
  }
  struct RecoveryRequest {
    bytes passkey;
    uint256 timestamp;
  }

  error GuardianNotFound(address guardian);
  error GuardianNotProposed(address guardian);
  error PasskeyNotMatched();
  error CooldownPerionNotPassed();
  error ExpiredRequest();

  /// @dev Event indicating new recovery process being initiated
  event RecoveryInitiated(address account, address guardian);

  uint256 constant REQUEST_VALIDITY_TIME = 72 * 60 * 60; // 72 hours
  uint256 constant REQUEST_DELAY_TIME = 24 * 60 * 60; // 24 hours

  mapping(address account => Guardian[]) public accountGuardians;
  mapping(address guardian => address[]) public guardedAccounts;
  mapping(address account => RecoveryRequest) public pendingRecoveryData;
  mapping(bytes32 passkeyHash => address) public recoveryRequestByPasskey;

  address public webAuthValidator;

  /// @notice The constructor sets the web authn validator for which recovery process can be initiated. Used only for non proxied deployment
  constructor(address _webAuthValidator) {
    initialize(_webAuthValidator);
  }

  /// @notice Initializer function that sets validator initial configuration. Expected to be used in the proxy.
  /// @dev Sets webAuthValidator address
  /// @param _webAuthValidator Address of WebAuthnValidator contracts
  function initialize(address _webAuthValidator) public initializer {
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
    Guardian[] storage guardians = accountGuardians[msg.sender];

    // If the guardian exist this method stops
    for (uint256 i = 0; i < guardians.length; i++) {
      if (guardians[i].addr == newGuardian) {
        return;
      }
    }

    guardians.push(Guardian(newGuardian, false));
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
        // If found last guardian is moved to current position, and then
        // last element is removed from array.
        guardians[i] = guardians[guardians.length - 1];
        guardians.pop();
        break;
      }
    }

    address[] storage accounts = guardedAccounts[guardianToRemove];
    for (uint256 i = 0; i < accounts.length; i++) {
      if (accounts[i] == msg.sender) {
        // If found last account is moved to current position, and then
        // last element is removed from array.
        accounts[i] = accounts[accounts.length - 1];
        accounts.pop();
        return;
      }
    }

    revert GuardianNotFound(guardianToRemove);
  }

  /// @notice This method allows to accept being a guardian of given account
  /// @param key Encoded address of account which msg.sender is becoming guardian of
  /// @return Flag indicating whether guardian was already valid or not
  function addValidationKey(bytes memory key) external returns (bool) {
    // Interprets argument as address;
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

  /// @notice This method allows to accept being a guardian of given account
  /// @param accountToRecover Address of account for which given recovery is initiated
  /// @param passkey Encoded new passkey, that will be passed to WebAuthnModule
  function initRecovery(address accountToRecover, bytes memory passkey) external onlyGuardianOf(accountToRecover) {
    pendingRecoveryData[accountToRecover] = RecoveryRequest(passkey, block.timestamp);
    recoveryRequestByPasskey[keccak256(passkey)] = accountToRecover;

    emit RecoveryInitiated(accountToRecover, msg.sender);
  }

  /// @notice This method allows to discard currently pending recovery
  function discardRecovery() external {
    RecoveryRequest storage request = pendingRecoveryData[msg.sender];
    delete recoveryRequestByPasskey[keccak256(request.passkey)];
    delete pendingRecoveryData[msg.sender];
  }

  /// @notice Checks if a given passkey matches a pending recovery request and is ready to be used
  /// @param passkey The passkey to verify
  /// @return account The account being recovered (zero address if no match)
  /// @return ready True if the passkey matches and is ready to be used
  /// @return remainingTime Time in seconds until the passkey can be used (0 if ready or no match)
  function checkRecoveryRequest(
    bytes calldata passkey
  ) external view returns (address account, bool ready, uint256 remainingTime) {
    account = recoveryRequestByPasskey[keccak256(passkey)];

    if (account == address(0)) {
      return (account, false, 0);
    }

    RecoveryRequest storage request = pendingRecoveryData[account];
    uint256 timePassedSinceRequest = block.timestamp - request.timestamp;

    // If request expired
    if (timePassedSinceRequest > REQUEST_VALIDITY_TIME) {
      return (account, false, 0);
    }

    // If still in cooldown period
    if (timePassedSinceRequest < REQUEST_DELAY_TIME) {
      return (account, false, REQUEST_DELAY_TIME - timePassedSinceRequest);
    }

    // Passkey matches and is ready to be used
    return (account, true, 0);
  }

  /// @inheritdoc IModuleValidator
  function validateTransaction(
    bytes32 signedHash,
    bytes memory signature,
    Transaction calldata transaction
  ) external returns (bool) {
    // If the user has a recovery in progress then:
    //   1. The method will verify calls to `WebAuthnModule`
    //   2. Checks if the transaction is attempting to modify passkeys
    //   3. Verify the new passkey is the one stored in `initRecovery`
    //   4. Allows anyone to call this method, as the recovery was already verified in `initRecovery`
    //   5. Verifies that the required timelock period has passed since `initRecovery` was called
    (bytes memory transactionSignature, address _validator, bytes memory validatorData) = SignatureDecoder
      .decodeSignature(transaction.signature);

    require(transaction.data.length >= 4, "Only function calls are supported");
    bytes4 selector = bytes4(transaction.data[:4]);

    require(transaction.to <= type(uint160).max, "Overflow");
    address target = address(uint160(transaction.to));

    if (target == address(webAuthValidator)) {
      // Check for calling "addValidationKey" method by anyone on WebAuthValidator contract
      require(selector == WebAuthValidator.addValidationKey.selector, "Unsupported function call");
      bytes memory validationKeyData = abi.decode(transaction.data[4:], (bytes));

      // Verify that current request matches pending one
      if (
        pendingRecoveryData[msg.sender].passkey.length != validationKeyData.length ||
        keccak256(pendingRecoveryData[msg.sender].passkey) != keccak256(validationKeyData)
      ) revert PasskeyNotMatched();

      // Ensure time constraints
      uint256 timePassedSinceRequest = block.timestamp - pendingRecoveryData[msg.sender].timestamp;
      if (timePassedSinceRequest < REQUEST_DELAY_TIME) revert CooldownPerionNotPassed();
      if (timePassedSinceRequest > REQUEST_VALIDITY_TIME) revert ExpiredRequest();

      // Cleanup currently processed recovery data
      delete recoveryRequestByPasskey[keccak256(pendingRecoveryData[msg.sender].passkey)];
      delete pendingRecoveryData[msg.sender];

      return true;
    }

    return false;
  }

  /// @inheritdoc IModuleValidator
  function validateSignature(bytes32, bytes memory) external view returns (bool) {
    return false;
  }

  /// @inheritdoc IERC165
  function supportsInterface(bytes4 interfaceId) external view override returns (bool) {
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
