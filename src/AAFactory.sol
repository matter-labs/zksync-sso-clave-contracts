// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { DEPLOYER_SYSTEM_CONTRACT } from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import { IContractDeployer } from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IContractDeployer.sol";
import { SystemContractsCaller } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";

import { ISsoAccount } from "./interfaces/ISsoAccount.sol";
import { Errors } from "./libraries/Errors.sol";

/// @title AAFactory
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev This contract is used to deploy SSO accounts as beacon proxies.
contract AAFactory {
  // Order of Layout: State
  /// @dev The bytecode hash of the beacon proxy, used for deploying proxy accounts.
  bytes32 public immutable beaconProxyBytecodeHash;
  /// @dev The address of the SsoBeacon contract used for the SSO accounts' beacon proxies.
  address public immutable beacon;
  /// @dev The address of the pass key module address
  address public immutable passKeyModule;
  /// @dev The address of the session key module address
  address public immutable sessionKeyModule;

  /// @notice A mapping from unique account IDs to their corresponding deployed account addresses.
  mapping(bytes32 accountId => address deployedAccount) public accountMappings;

  // Order of Layout: Events

  /// @notice Emitted when a new account is successfully created.
  /// @param accountAddress The address of the newly created account.
  /// @param uniqueAccountId A unique identifier for the account.
  event AccountCreated(address indexed accountAddress, bytes32 uniqueAccountId);

  // Order of Layout: Errors
  error EMPTY_BEACON_BYTECODE_HASH();
  error EMPTY_BEACON_ADDRESS();
  error EMPTY_PASSKEY_ADDRESS();
  error EMPTY_SESSIONKEY_ADDRESS();

  // Order of Layout: Functions

  /// @notice Constructor that initializes the factory with a beacon proxy bytecode hash and implementation contract address.
  /// @param _beaconProxyBytecodeHash The bytecode hash of the beacon proxy.
  /// @param _beacon The address of the UpgradeableBeacon contract used for the SSO accounts' beacon proxies.
  /// @param _passKeyModule The address of the UpgradeableBeacon contract used for the SSO accounts' passkey proxies.
  /// @param _sessionKeyModule The address of the UpgradeableBeacon contract used for the SSO accounts' sessionkey proxies.
  constructor(bytes32 _beaconProxyBytecodeHash, address _beacon, address _passKeyModule, address _sessionKeyModule) {
    if (_beaconProxyBytecodeHash == bytes32(0)) {
      revert EMPTY_BEACON_BYTECODE_HASH();
    }
    beaconProxyBytecodeHash = _beaconProxyBytecodeHash;
    if (_beacon == address(0)) {
      revert EMPTY_BEACON_ADDRESS();
    }
    beacon = _beacon;
    if (_passKeyModule == address(0)) {
      revert EMPTY_PASSKEY_ADDRESS();
    }
    passKeyModule = _passKeyModule;
    if (_sessionKeyModule == address(0)) {
      revert EMPTY_SESSIONKEY_ADDRESS();
    }
    sessionKeyModule = _sessionKeyModule;
  }

  function getEncodedBeacon() external view returns (bytes memory) {
    return abi.encode(beacon);
  }

  /// @notice Deploys a new SSO account as a beacon proxy with the specified parameters.
  /// @dev Uses `create2` to deploy a proxy account, allowing for deterministic addresses based on the provided unique id.
  /// @param uniqueId Use to generate a unique account id and deterministic address calculation (create2 salt).
  /// @param initialValidators An array of initial validators for the new account.
  /// @param initialK1Owners An array of initial owners of the K1 key for the new account.
  /// @return accountAddress The address of the newly deployed SSO account.
  function deployProxySsoAccount(
    bytes32 uniqueId,
    bytes[] memory initialValidators,
    address[] calldata initialK1Owners
  ) public returns (address accountAddress) {
    bytes32 uniqueAccountId = keccak256(abi.encodePacked(uniqueId, msg.sender));
    address existingAccountAddress = accountMappings[uniqueAccountId];
    if (existingAccountAddress != address(0)) {
      revert Errors.ACCOUNT_ALREADY_EXISTS(existingAccountAddress);
    }

    bytes memory returnData = SystemContractsCaller.systemCallWithPropagatedRevert(
      uint32(gasleft()),
      address(DEPLOYER_SYSTEM_CONTRACT),
      uint128(0),
      abi.encodeCall(
        DEPLOYER_SYSTEM_CONTRACT.create2Account,
        (
          uniqueAccountId,
          beaconProxyBytecodeHash,
          abi.encode(beacon),
          IContractDeployer.AccountAbstractionVersion.Version1
        )
      )
    );
    (accountAddress) = abi.decode(returnData, (address));

    accountMappings[uniqueAccountId] = accountAddress;

    // Initialize the newly deployed account with validators and K1 owners.
    ISsoAccount(accountAddress).initialize(initialValidators, initialK1Owners);

    emit AccountCreated(accountAddress, uniqueAccountId);
  }

  /// @notice Deploys a new SSO account as a beacon proxy with the specified parameters.
  /// @notice Requires at least of the following: passkey, session key, or owner address.
  /// @dev Uses `deployProxySsoAccount` with saved passkey and session key modules addresses.
  /// @param uniqueId Use to generate a account address with the msg.sender
  /// @param passKey Credential id, raw R1 public key, and origin domain for WebAuthN validation
  /// @param sessionKey Session spec for session validation
  /// @param ownerKeys An array of initial owners of the K1 key for the new account.
  /// @return accountAddress The address of the newly deployed SSO account.
  function deployModularAccount(
    bytes32 uniqueId,
    bytes calldata passKey,
    bytes calldata sessionKey,
    address[] calldata ownerKeys
  ) external returns (address accountAddress) {
    if (passKey.length == 0 && sessionKey.length == 0 && ownerKeys.length == 0) {
      revert Errors.INVALID_ACCOUNT_KEYS();
    }

    bytes memory passKeyData = abi.encode(passKeyModule, passKey);
    bytes memory sessionKeyData = abi.encode(sessionKeyModule, sessionKey);
    bytes[] memory initialValidators = new bytes[](2);
    initialValidators[0] = passKeyData;
    initialValidators[1] = sessionKeyData;
    return deployProxySsoAccount(uniqueId, initialValidators, ownerKeys);
  }
}
