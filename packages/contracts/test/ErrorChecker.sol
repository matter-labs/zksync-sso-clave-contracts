// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { Test, console } from "forge-std/Test.sol";

contract CounterTest is Test {
  error INVALID_PUBKEY_LENGTH();

  function test() public {
    // console.logBytes4(INVALID_PUBKEY_LENGTH.selector);
  }
}
