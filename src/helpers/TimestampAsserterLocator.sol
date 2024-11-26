// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/ITimestampAsserter.sol";

library TimestampAsserterLocator {
  function locate() internal view returns (ITimestampAsserter) {
    if (block.chainid == 260) {
      return ITimestampAsserter(address(0x00000000000000000000000000000000808012));
    }
    if (block.chainid == 300) {
      revert("Timestamp asserter is not deployed on ZKsync Sepolia testnet yet");
    }
    if (block.chainid == 324) {
      revert("Timestamp asserter is not deployed on ZKsync mainnet yet");
    }
    revert("Timestamp asserter is not deployed on this network");
  }
}
