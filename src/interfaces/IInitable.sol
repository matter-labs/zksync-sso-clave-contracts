// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IInitable {
  function init(bytes calldata initData) external;

  function disable() external;
}
