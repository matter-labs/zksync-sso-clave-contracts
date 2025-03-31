// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract ERC1271Caller is EIP712 {
  struct TestStruct {
    string message;
    uint256 value;
  }

  constructor() EIP712("ERC1271Caller", "1.0.0") {}

  function validateStruct(
    TestStruct calldata testStruct,
    address signer,
    bytes calldata signature
  ) external view returns (bool) {
    require(signer != address(0), "Invalid signer address");

    bytes32 structHash = keccak256(
      abi.encode(
        keccak256("TestStruct(string message,uint256 value)"),
        keccak256(bytes(testStruct.message)),
        testStruct.value
      )
    );

    bytes32 digest = _hashTypedDataV4(structHash);

    if (Address.isContract(signer)) {
      // Call the ERC1271 contract
      bytes4 magic = IERC1271(signer).isValidSignature(digest, signature);
      return magic == IERC1271.isValidSignature.selector;
    } else {
      return ECDSA.recover(digest, signature) == signer;
    }
  }
}
