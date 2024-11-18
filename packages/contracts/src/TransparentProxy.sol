// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

// This proxy is placed in front of AAFactory and all modules (WebAuthValidator, SessionKeyValidator).

// TODO: use this to optimize gas?
// import { EfficientCall } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/EfficientCall.sol";
import { TransparentUpgradeableProxy } from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract TransparentProxy is TransparentUpgradeableProxy {
  constructor(address implementation) TransparentUpgradeableProxy(implementation, msg.sender, bytes("")) {}
}
