// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ZeekNFTQuest is ERC721, Ownable {
  uint256 private _tokenIds;
  string private _baseTokenURI;

  constructor(string memory baseTokenURI) ERC721("NFT Quest Zeek", "ZEEK") {
    _baseTokenURI = baseTokenURI;
  }

  function mint(address to) external returns (uint256) {
    _tokenIds++;
    uint256 newTokenId = _tokenIds;
    _mint(to, newTokenId);
    return newTokenId;
  }

  function tokenURI() public view virtual returns (string memory) {
    return _baseTokenURI;
  }
}
