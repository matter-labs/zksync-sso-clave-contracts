// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Dummy {
  string public constant dummy = "dummy";

  function justRevert() public pure {
    revert("Just reverted");
  }
}
