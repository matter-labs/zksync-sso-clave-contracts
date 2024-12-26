// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { JsmnSolLib } from "../libraries/JsmnSolLib.sol";

import "hardhat/console.sol";

contract JsmnSolLibTest {
  function init(uint256 length) external pure returns (JsmnSolLib.Parser memory, JsmnSolLib.Token[] memory) {
    return JsmnSolLib.init(length);
  }

  function parse(
    string calldata json,
    uint256 length
  ) external pure returns (uint, JsmnSolLib.Token[] memory tokens, uint) {
    return JsmnSolLib.parse(abi.decode(abi.encode(json), (string)), length);
  }

  function getBytes(string calldata json, uint256 start, uint256 end) external pure returns (string memory) {
    return JsmnSolLib.getBytes(string(abi.decode(abi.encode(json), (string))), start, end);
  }

  function parseIntNoSize(string memory a) external pure returns (int256) {
    return JsmnSolLib.parseInt(string(abi.decode(abi.encode(a), (string))));
  }

  function parseIntSize(string calldata a, uint256 length) external pure returns (int256) {
    return JsmnSolLib.parseInt(string(abi.decode(abi.encode(a), (string))), length);
  }

  function parseBool(string memory b) external pure returns (bool) {
    return JsmnSolLib.parseBool(string(abi.decode(abi.encode(b), (string))));
  }
}
