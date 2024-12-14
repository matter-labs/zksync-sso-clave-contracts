// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { UpgradeableBeacon } from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

/// @title SsoBeacon
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
contract SsoBeacon is UpgradeableBeacon {
  constructor(address _implementation) UpgradeableBeacon(_implementation) {}
}
