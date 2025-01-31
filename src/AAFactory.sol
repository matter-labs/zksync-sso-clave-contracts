// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { DEPLOYER_SYSTEM_CONTRACT, IContractDeployer } from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import { SystemContractsCaller } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";

import { ISsoAccount } from "./interfaces/ISsoAccount.sol";

/// @title AAFactory
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev This contract is used to deploy SSO accounts as beacon proxies.
contract AAFactory {
  /// @notice Emitted when a new account is successfully created.
  /// @param accountAddress The address of the newly created account.
  /// @param uniqueAccountId A unique identifier for the account.
  event AccountCreated(address indexed accountAddress, string uniqueAccountId);

  /// @dev The bytecode hash of the beacon proxy, used for deploying proxy accounts.
  bytes32 public immutable beaconProxyBytecodeHash;
  address public immutable beacon;

  /// @notice A mapping from unique account IDs to their corresponding deployed account addresses.
  mapping(string => address) public accountMappings;

  /// @notice A mapping from account addresses to their corresponding unique account IDs.
  mapping(address => string) public accountIds;

  /// @notice A mapping that marks account IDs as being used for recovery.
  /// @dev This is used to prevent the same account ID from being used for recovery, deployment and future uses.
  mapping(string => address) public recoveryBlockedAccountIds;

  /// @notice Constructor that initializes the factory with a beacon proxy bytecode hash and implementation contract address.
  /// @param _beaconProxyBytecodeHash The bytecode hash of the beacon proxy.
  /// @param _beacon The address of the UpgradeableBeacon contract used for the SSO accounts' beacon proxies.
  constructor(bytes32 _beaconProxyBytecodeHash, address _beacon) {
    beaconProxyBytecodeHash = _beaconProxyBytecodeHash;
    beacon = _beacon;
  }

  function getEncodedBeacon() external view returns (bytes memory) {
    return abi.encode(beacon);
  }

  /// @notice Deploys a new SSO account as a beacon proxy with the specified parameters.
  /// @dev Uses `create2` to deploy a proxy account, allowing for deterministic addresses based on the provided salt.
  /// @param _salt The salt used for the `create2` deployment to make the address deterministic.
  /// @param _uniqueAccountId A unique identifier for the new account.
  /// @param _initialValidators An array of initial validators for the new account.
  /// @param _initialK1Owners An array of initial owners of the K1 key for the new account.
  /// @return accountAddress The address of the newly deployed SSO account.
  function deployProxySsoAccount(
    bytes32 _salt,
    string calldata _uniqueAccountId,
    bytes[] calldata _initialValidators,
    address[] calldata _initialK1Owners
  ) external returns (address accountAddress) {
    require(
      accountMappings[_uniqueAccountId] == address(0) && bytes(accountIds[msg.sender]).length == 0,
      "Account already exists"
    );
    require(recoveryBlockedAccountIds[_uniqueAccountId] == address(0), "Account ID is being used for recovery");

    (bool success, bytes memory returnData) = SystemContractsCaller.systemCallWithReturndata(
      uint32(gasleft()),
      address(DEPLOYER_SYSTEM_CONTRACT),
      uint128(0),
      abi.encodeCall(
        DEPLOYER_SYSTEM_CONTRACT.create2Account,
        (_salt, beaconProxyBytecodeHash, abi.encode(beacon), IContractDeployer.AccountAbstractionVersion.Version1)
      )
    );
    require(success, "Deployment failed");
    (accountAddress) = abi.decode(returnData, (address));

    // Initialize the newly deployed account with validators, hooks and K1 owners.
    ISsoAccount(accountAddress).initialize(_initialValidators, _initialK1Owners);

    _registerAccount(_uniqueAccountId, accountAddress);

    emit AccountCreated(accountAddress, _uniqueAccountId);
  }

  /// @notice Registers an account with a given account ID.
  /// @dev Can only be called by the account's validators.
  /// @param _uniqueAccountId The unique identifier for the account.
  /// @param _accountAddress The address of the account to register.
  function registerAccount(
    string calldata _uniqueAccountId,
    address _accountAddress
  ) external onlyAccountValidator(_accountAddress) {
    _registerAccount(_uniqueAccountId, _accountAddress);
  }

  function _registerAccount(string calldata _uniqueAccountId, address _accountAddress) internal {
    accountMappings[_uniqueAccountId] = _accountAddress;
    accountIds[_accountAddress] = _uniqueAccountId;
  }

  /// @notice Unregisters an account from the factory.
  /// @dev Can only be called by the account's validators.
  /// @param _uniqueAccountId The unique identifier for the account.
  /// @param _accountAddress The address of the account to unregister.
  function unregisterAccount(
    string memory _uniqueAccountId,
    address _accountAddress
  ) external onlyAccountValidator(_accountAddress) {
    accountMappings[_uniqueAccountId] = address(0);
    accountIds[_accountAddress] = "";
  }

  /// @notice Updates the account mapping for a given account ID during recovery.
  /// @dev Can only be called by the account's validators.
  /// @param _uniqueAccountId The unique identifier for the account.
  /// @param _accountAddress The address of the account to update the mapping for.
  function registerRecoveryBlockedAccount(
    string calldata _uniqueAccountId,
    address _accountAddress
  ) external onlyAccountValidator(_accountAddress) {
    recoveryBlockedAccountIds[_uniqueAccountId] = _accountAddress;
  }

  /// @notice Unregisters a recovery blocked account from the factory.
  /// @dev Can only be called by the account's validators.
  /// @param _uniqueAccountId The unique identifier for the account.
  /// @param _accountAddress The address of the account to unregister.
  function unregisterRecoveryBlockedAccount(
    string calldata _uniqueAccountId,
    address _accountAddress
  ) external onlyAccountValidator(_accountAddress) {
    recoveryBlockedAccountIds[_uniqueAccountId] = address(0);
  }

  /// @notice Modifier that checks if the caller is a validator for the given account.
  /// @param _accountAddress The address of the account to check the validator for.
  modifier onlyAccountValidator(address _accountAddress) {
    require(ISsoAccount(_accountAddress).isModuleValidator(msg.sender), "Unauthorized validator");
    _;
  }
}
