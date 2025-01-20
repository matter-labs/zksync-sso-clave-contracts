// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ITimestampAsserter } from "../interfaces/ITimestampAsserter.sol";

/// @title Timestamp asserter locator
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @notice This library is used to locate the TimestampAsserter contract on different networks.
/// @dev Might be removed in the future, when TimestampAsserter is deployed via create2 to the same address on all networks.
library TimestampAsserterLocator {
  function locate() internal view returns (ITimestampAsserter) {
    // anvil-zksync (era-test-node)
    if (block.chainid == 260) {
      return ITimestampAsserter(address(0x00000000000000000000000000000000808012));
    }
    // era sepolia testnet
    if (block.chainid == 300) {
      return ITimestampAsserter(address(0xa64EC71Ee812ac62923c85cf0796aA58573c4Cf3));
    }
    // era mainnet
    if (block.chainid == 324) {
      revert("Timestamp asserter is not deployed on ZKsync mainnet yet");
    }
    revert("Timestamp asserter is not deployed on this network");
  }
}
