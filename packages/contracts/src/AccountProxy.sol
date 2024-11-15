// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

// TODO: use this to optimize gas?
// import { EfficientCall } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/EfficientCall.sol";
import { BeaconProxy } from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

contract AccountProxy is BeaconProxy {
  constructor(address beacon, bytes memory data) BeaconProxy(beacon, data) {}
}
