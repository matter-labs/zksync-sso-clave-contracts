// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";

import { IClaveAccount } from "./interfaces/IClaveAccount.sol";
// import "hardhat/console.sol";

contract AAFactory {
  bytes32 public proxyAaBytecodeHash;

  // This 3 step mapping prevents collisions and does the lookup from public to private information
  // creator => unique id => account info
  mapping(address => mapping(string => address)) public accountMappings;

  constructor(bytes32 _proxyAaBytecodeHash) {
    proxyAaBytecodeHash = _proxyAaBytecodeHash;
  }

  function addNewUniqueId(bytes32 uniqueAccountId) external {}

  function deployProxy7579Account(
    bytes32 salt,
    address accountImplementionLocation,
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
          proxyAaBytecodeHash,
          abi.encode(accountImplementionLocation),
          IContractDeployer.AccountAbstractionVersion.Version1
        )
      )
    );
    require(success, "Deployment failed");

    (accountAddress) = abi.decode(returnData, (address));
    // console.log("accountAddress %s", accountAddress);

    // add session-key/spend-limit module (similar code)
    IClaveAccount(accountAddress).initialize(initialValidators, initialModules, initialK1Owners);

    if (accountMappings[msg.sender][uniqueAccountId] != address(0)) {
      revert("Account already exists");
    }
    accountMappings[msg.sender][uniqueAccountId] = accountAddress;
  }
}
