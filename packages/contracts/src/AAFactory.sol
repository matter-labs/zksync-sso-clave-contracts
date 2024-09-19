// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";

import {IClaveAccount} from "./interfaces/IClaveAccount.sol";
import "hardhat/console.sol";

contract AAFactory {
    bytes32 public proxyAaBytecodeHash;

    struct MetaAccountConnection {
        address accountLocation;
        string publicPasskey; // used for addtional on-chain validation
    }

    // This 4 step mapping prevents collisions and does the lookup from public to private information
    // login provider => unique id => creator => account info
    mapping(string => mapping(string => mapping(address => MetaAccountConnection)))
        public accountMappings;

    constructor(bytes32 _proxyAaBytecodeHash) {
        proxyAaBytecodeHash = _proxyAaBytecodeHash;
    }

    function deployProxy7579Account(
        bytes32 salt,
        address accountImplementionLocation,
        bytes calldata initialR1Owner,
        address initialR1Validator,
        address initialModule,
        bytes calldata initData
    ) external returns (address accountAddress) {
        (bool success, bytes memory returnData) = SystemContractsCaller
            .systemCallWithReturndata(
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
        console.log("accountAddress %s", accountAddress);

        // add session-key/spend-limit module (similar code)
        IClaveAccount(accountAddress).initialize(
            initialR1Owner,
            initialR1Validator,
            initialModule,
            initData
        );
    }
}
