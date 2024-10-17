// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title ERC20TestToken
 * @dev This is a basic ERC20 token using the OpenZeppelin's ERC20PresetFixedSupply preset.
 */
contract ERC20TestToken is ERC20Burnable {
  /**
   * @dev Constructor that allows setting the token's name and symbol.
   * @param name_ The name of the token.
   * @param symbol_ The symbol of the token.
   */
  constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

  /**
   * @dev Mint any amount of tokens to a specific address.
   * @param to The address to mint tokens to.
   * @param amount The amount of tokens to mint.
   */
  function mint(address to, uint256 amount) public {
    _mint(to, amount);
  }
}
