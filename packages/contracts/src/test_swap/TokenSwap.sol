// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
  function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
  function transfer(address recipient, uint256 amount) external returns (bool);
  function balanceOf(address account) external view returns (uint256);
}

contract TokenSwap {
  IERC20 public tokenA;
  IERC20 public tokenB;
  uint256 public constant swapRatio = 2;

  constructor(address _tokenA, address _tokenB) {
    tokenA = IERC20(_tokenA);
    tokenB = IERC20(_tokenB);
  }

  function swap(uint256 amountA) public {
    require(amountA > 0, "Amount must be greater than 0");

    // Calculate the amount of token B to give (2x token A)
    uint256 amountB = amountA * swapRatio;

    // Ensure the contract has enough B tokens to swap
    require(tokenB.balanceOf(address(this)) >= amountB, "Not enough B tokens in contract");

    // Transfer Token A from the user to the contract
    require(tokenA.transferFrom(msg.sender, address(this), amountA), "Transfer of token A failed");

    // Transfer Token B from the contract to the user
    require(tokenB.transfer(msg.sender, amountB), "Transfer of token B failed");
  }
}
