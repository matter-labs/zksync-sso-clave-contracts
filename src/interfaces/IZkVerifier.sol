interface IZkVerifier {
  function verifyProof(
    uint256[2] calldata _pA,
    uint256[2][2] calldata _pB,
    uint256[2] calldata _pC,
    uint256[20] calldata _pubSignals
  ) external view returns (bool);
}
