// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (proxy/beacon/UpgradeableBeacon.sol)
// Modified by Matter Labs

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/StorageSlot.sol";

/**
 * @dev This contract is used in conjunction with one or more instances of {BeaconProxy} to determine their
 * implementation contract, which is where they will delegate all function calls.
 *
 * An owner is able to change the implementation the beacon points to, thus upgrading the proxies that use this beacon.
 */
contract UpgradeableBeacon is IBeacon, Ownable {
  // obtained as keccak256('eip1967.proxy.implementation') - 1
  bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

  /**
   * @dev Emitted when the implementation returned by the beacon is changed.
   */
  event Upgraded(address indexed implementation);

  /**
   * @dev The `implementation` of the beacon is invalid.
   */
  error BeaconInvalidImplementation(address implementation);

  /**
   * @dev Sets the address of the initial implementation, and the deployer account as the owner who can upgrade the
   * beacon.
   */
  constructor(address implementation_) {
    _setImplementation(implementation_);
  }

  /**
   * @dev Returns the current implementation address.
   */
  function implementation() external view returns (address) {
    return StorageSlot.getAddressSlot(IMPLEMENTATION_SLOT).value;
  }

  /**
   * @dev Upgrades the beacon to a new implementation.
   *
   * Emits an {Upgraded} event.
   *
   * Requirements:
   *
   * - msg.sender must be the owner of the contract.
   * - `newImplementation` must be a contract.
   */
  function upgradeTo(address newImplementation) public virtual onlyOwner {
    _setImplementation(newImplementation);
  }

  /**
   * @dev Sets the implementation contract address for this beacon
   *
   * Requirements:
   *
   * - `newImplementation` must be a contract.
   */
  function _setImplementation(address newImplementation) private {
    if (newImplementation.code.length == 0) {
      revert BeaconInvalidImplementation(newImplementation);
    }
    StorageSlot.getAddressSlot(IMPLEMENTATION_SLOT).value = newImplementation;
    emit Upgraded(newImplementation);
  }
}
