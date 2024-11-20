// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";

import { ISsoAccount } from "./interfaces/ISsoAccount.sol";
import { UpgradeableBeacon } from "./UpgradeableBeacon.sol";

import "./helpers/Logger.sol";

contract AAFactory is UpgradeableBeacon {
  bytes32 public immutable beaconProxyBytecodeHash;

  // This is a mapping from unique id => account address
  mapping(string => address) public accountMappings;

  constructor(bytes32 _beaconProxyBytecodeHash, address implementation) UpgradeableBeacon(implementation) {
    beaconProxyBytecodeHash = _beaconProxyBytecodeHash;
  }

  function deployProxySsoAccount(
    bytes32 salt,
    string calldata uniqueAccountId,
    bytes[] calldata initialValidators,
    bytes[] calldata initialModules,
    address[] calldata initialK1Owners
  ) external returns (address accountAddress) {
    (bool success, bytes memory returnData) = SystemContractsCaller.systemCallWithReturndata(
      uint32(gasleft()),
      address(DEPLOYER_SYSTEM_CONTRACT),
      uint128(0),
      abi.encodeCall(
        DEPLOYER_SYSTEM_CONTRACT.create2Account,
        (
          salt,
          beaconProxyBytecodeHash,
          abi.encode(address(this), bytes("")),
          IContractDeployer.AccountAbstractionVersion.Version1
        )
      )
    );
    require(success, "Deployment failed");

    (accountAddress) = abi.decode(returnData, (address));

    Logger.logString("accountAddress");
    Logger.logAddress(accountAddress);

    // add session-key/spend-limit module (similar code)
    ISsoAccount(accountAddress).initialize(initialValidators, initialModules, initialK1Owners);

    if (accountMappings[uniqueAccountId] != address(0)) {
      revert("Account already exists");
    }
    accountMappings[uniqueAccountId] = accountAddress;
  }
}
