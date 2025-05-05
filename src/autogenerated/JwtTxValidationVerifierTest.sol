// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16VerifierTest {
  // Scalar field size
  uint256 constant r = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
  // Base field size
  uint256 constant q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

  // Verification Key data
  uint256 constant alphax = 16428432848801857252194528405604668803277877773566238944394625302971855135431;
  uint256 constant alphay = 16846502678714586896801519656441059708016666274385668027902869494772365009666;
  uint256 constant betax1 = 3182164110458002340215786955198810119980427837186618912744689678939861918171;
  uint256 constant betax2 = 16348171800823588416173124589066524623406261996681292662100840445103873053252;
  uint256 constant betay1 = 4920802715848186258981584729175884379674325733638798907835771393452862684714;
  uint256 constant betay2 = 19687132236965066906216944365591810874384658708175106803089633851114028275753;
  uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
  uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
  uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
  uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
  uint256 constant deltax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
  uint256 constant deltax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
  uint256 constant deltay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
  uint256 constant deltay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;

  uint256 constant IC0x = 8397427344138159554517929267649643427887663627744615768694280077600629688061;
  uint256 constant IC0y = 21876305574098892254461995258481899219465782133295340476105296971177691490296;

  uint256 constant IC1x = 449234908006869331344343228658435673586922373473104480650877760214573760529;
  uint256 constant IC1y = 7431533136392947040386247173002381842133072558594289770298529225654458593445;

  uint256 constant IC2x = 13717421993948844697724225105839416933493869467965496166987496196458884202859;
  uint256 constant IC2y = 14370730281059689548173403662029358654851088663138932409508336037054559140619;

  uint256 constant IC3x = 2099082894755144424671847750481323801053011721196036388918814876029979994637;
  uint256 constant IC3y = 16386691489750731957735604009213829825318510528350166117136575325438771256135;

  uint256 constant IC4x = 20485728032212468040461225524978912954359846084553608033036080467707753996842;
  uint256 constant IC4y = 8129277848220308821424205373825924366912890247290567950651667440549121732089;

  uint256 constant IC5x = 6815447897558680441134658620892597015199321519309776206779468221862314389723;
  uint256 constant IC5y = 8228685297415749735866269833345266069562833396475419891363941969390877089879;

  uint256 constant IC6x = 1502729394853031979171821446379689148596147449144894920553813489937963473328;
  uint256 constant IC6y = 16564062064116074393435469542648101348569785396160677628170122270618428160353;

  uint256 constant IC7x = 19561278199261342695529983345614982735310178697178076241093484555005448023753;
  uint256 constant IC7y = 7465057258521701145257493036581415268092351463799114310778978053083294963197;

  uint256 constant IC8x = 2084921437467209614586699539425010512490964471538243776009812234641548504927;
  uint256 constant IC8y = 10098630149121599343163879591044932827077365492782351420352446916270788084646;

  uint256 constant IC9x = 17928717401464688908084068495464406009297837989888046034883856796092310162428;
  uint256 constant IC9y = 17292064113161016927170331107448618363398907498239884483336375252051247112721;

  uint256 constant IC10x = 4163395116626010544900472369207798014018345290277553386605692986660422764679;
  uint256 constant IC10y = 12785981806269823714625878314554283329938332941469313149464515044508623248020;

  uint256 constant IC11x = 21289544981470309599930035285072487196566872772595935907467810984790116893603;
  uint256 constant IC11y = 10867409806843557818519195658009163179109114159680167727185794446073160853325;

  uint256 constant IC12x = 19476765218072110724877431194785876591316952387358977899761257938691903928524;
  uint256 constant IC12y = 16861712143387908587049241463382301861449105841383478172339598963488883648147;

  uint256 constant IC13x = 18647074673360008408928343402488499876623506070115332042701278589307496709455;
  uint256 constant IC13y = 5453476943616587200279590395695997879618984364633071751045115664505554472083;

  uint256 constant IC14x = 19479859049671404448102761506973229959684911351397581142756423453534051859440;
  uint256 constant IC14y = 16571393214460221559246250038393078382293216322643845848108700318926489039698;

  uint256 constant IC15x = 7450839459662247275436447299153997581933550008958438236824035750605238879832;
  uint256 constant IC15y = 9566895020271910287124416535552394464526396535206124335549318133083094140100;

  uint256 constant IC16x = 6988926559616845457825102253800874058598761991020776752126836609227955083927;
  uint256 constant IC16y = 1420031351095374075491413421087717016560819098473286413910247840273745816191;

  uint256 constant IC17x = 1750948969311645555660934201070114290176613137231722399938660729686614411958;
  uint256 constant IC17y = 13377883544548255321942375088782457953499719058917880875591605869743740307470;

  uint256 constant IC18x = 19223475761129567887250291590480810992476625255356404131983316901853832727201;
  uint256 constant IC18y = 1564944490609489853424716756994728279634809493587639203720285365666268796610;

  uint256 constant IC19x = 13033800400441103377317284380704600107883492615864149039255070685866594964186;
  uint256 constant IC19y = 15603183592267449696075399578283791164237927277150224442459998427262166001913;

  uint256 constant IC20x = 818342603486032705141302511136036209083328413357913106207260199338567178097;
  uint256 constant IC20y = 17841938990937466883747890644501040238144065478808493897311221055965407010549;

  // Memory data
  uint16 constant pVk = 0;
  uint16 constant pPairing = 128;

  uint16 constant pLastMem = 896;

  function verifyProof(
    uint[2] calldata _pA,
    uint[2][2] calldata _pB,
    uint[2] calldata _pC,
    uint[20] calldata _pubSignals
  ) public view returns (bool) {
    assembly {
      function checkField(v) {
        if iszero(lt(v, r)) {
          mstore(0, 0)
          return(0, 0x20)
        }
      }

      // G1 function to multiply a G1 value(x,y) to value in an address
      function g1_mulAccC(pR, x, y, s) {
        let success
        let mIn := mload(0x40)
        mstore(mIn, x)
        mstore(add(mIn, 32), y)
        mstore(add(mIn, 64), s)

        success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

        if iszero(success) {
          mstore(0, 0)
          return(0, 0x20)
        }

        mstore(add(mIn, 64), mload(pR))
        mstore(add(mIn, 96), mload(add(pR, 32)))

        success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

        if iszero(success) {
          mstore(0, 0)
          return(0, 0x20)
        }
      }

      function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
        let _pPairing := add(pMem, pPairing)
        let _pVk := add(pMem, pVk)

        mstore(_pVk, IC0x)
        mstore(add(_pVk, 32), IC0y)

        // Compute the linear combination vk_x

        g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))

        g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))

        g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))

        g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))

        g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))

        g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))

        g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))

        g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))

        g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))

        g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))

        g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))

        g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))

        g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))

        g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))

        g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))

        g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))

        g1_mulAccC(_pVk, IC17x, IC17y, calldataload(add(pubSignals, 512)))

        g1_mulAccC(_pVk, IC18x, IC18y, calldataload(add(pubSignals, 544)))

        g1_mulAccC(_pVk, IC19x, IC19y, calldataload(add(pubSignals, 576)))

        g1_mulAccC(_pVk, IC20x, IC20y, calldataload(add(pubSignals, 608)))

        // -A
        mstore(_pPairing, calldataload(pA))
        mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

        // B
        mstore(add(_pPairing, 64), calldataload(pB))
        mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
        mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
        mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

        // alpha1
        mstore(add(_pPairing, 192), alphax)
        mstore(add(_pPairing, 224), alphay)

        // beta2
        mstore(add(_pPairing, 256), betax1)
        mstore(add(_pPairing, 288), betax2)
        mstore(add(_pPairing, 320), betay1)
        mstore(add(_pPairing, 352), betay2)

        // vk_x
        mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
        mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))

        // gamma2
        mstore(add(_pPairing, 448), gammax1)
        mstore(add(_pPairing, 480), gammax2)
        mstore(add(_pPairing, 512), gammay1)
        mstore(add(_pPairing, 544), gammay2)

        // C
        mstore(add(_pPairing, 576), calldataload(pC))
        mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

        // delta2
        mstore(add(_pPairing, 640), deltax1)
        mstore(add(_pPairing, 672), deltax2)
        mstore(add(_pPairing, 704), deltay1)
        mstore(add(_pPairing, 736), deltay2)

        let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

        isOk := and(success, mload(_pPairing))
      }

      let pMem := mload(0x40)
      mstore(0x40, add(pMem, pLastMem))

      // Validate that all evaluations ∈ F

      checkField(calldataload(add(_pubSignals, 0)))

      checkField(calldataload(add(_pubSignals, 32)))

      checkField(calldataload(add(_pubSignals, 64)))

      checkField(calldataload(add(_pubSignals, 96)))

      checkField(calldataload(add(_pubSignals, 128)))

      checkField(calldataload(add(_pubSignals, 160)))

      checkField(calldataload(add(_pubSignals, 192)))

      checkField(calldataload(add(_pubSignals, 224)))

      checkField(calldataload(add(_pubSignals, 256)))

      checkField(calldataload(add(_pubSignals, 288)))

      checkField(calldataload(add(_pubSignals, 320)))

      checkField(calldataload(add(_pubSignals, 352)))

      checkField(calldataload(add(_pubSignals, 384)))

      checkField(calldataload(add(_pubSignals, 416)))

      checkField(calldataload(add(_pubSignals, 448)))

      checkField(calldataload(add(_pubSignals, 480)))

      checkField(calldataload(add(_pubSignals, 512)))

      checkField(calldataload(add(_pubSignals, 544)))

      checkField(calldataload(add(_pubSignals, 576)))

      checkField(calldataload(add(_pubSignals, 608)))

      // Validate all evaluations
      let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

      mstore(0, isValid)
      return(0, 0x20)
    }
  }
}
