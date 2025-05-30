// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { BeaconProxy } from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import { SsoUtils } from "./helpers/SsoUtils.sol";

/// @title AccountProxy
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @notice This contract is modification of OpenZeppelin `BeaconProxy` with optimisation for
/// cheap delegate calls on ZKsync.
contract AccountProxy is BeaconProxy {
  constructor(address beacon) BeaconProxy(beacon, bytes("")) {}

  function _delegate(address implementation) internal override {
    SsoUtils.delegate(implementation);
  }
}
