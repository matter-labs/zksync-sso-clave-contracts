import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { expect } from "chai";
import { randomBytes } from "crypto";
import { ethers } from "ethers";
import { pad, parseEther, zeroAddress } from "viem";
import { Provider, SmartAccount, Wallet } from "zksync-ethers";

import { AAFactory, OidcKeyRegistry, OidcRecoveryValidator, WebAuthValidator } from "../typechain-types";
import { base64ToCircomBigInt, cacheBeforeEach, ContractFixtures, getProvider } from "./utils";

describe("OidcRecoveryValidator", function () {
  let fixtures: ContractFixtures;
  const provider = getProvider();
  let factory: AAFactory;
  let oidcValidator: OidcRecoveryValidator;
  let keyRegistry: OidcKeyRegistry;
  let webAuthValidator: WebAuthValidator;
  let ownerWallet: Wallet;
  const testWallet: Wallet = new Wallet("0x447f61a10b23ca123671e0ca8b2bb4f81d3d7485b70be9ec03fe8cdd49b7ec2e", provider);
  const JWK_MODULUS_64 = "y8TPCPz2Fp0OhBxsxu6d_7erT9f9XJ7mx7ZJPkkeZRxhdnKtg327D4IGYsC4fLAfpkC8qN58sZGkwRTNs-i7yaoD5_8nupq1tPYvnt38ddVghG9vws-2MvxfPQ9m2uxBEdRHmels8prEYGCH6oFKcuWVsNOt4l_OPoJRl4uiuiwd6trZik2GqDD_M6bn21_w6AD_jmbzN4mh8Od4vkA1Z9lKb3Qesksxdog-LWHsljN8ieiz1NhbG7M-GsIlzu-typJfud3tSJ1QHb-E_dEfoZ1iYK7pMcojb5ylMkaCj5QySRdJESq9ngqVRDjF4nX8DK5RQUS7AkrpHiwqyW0Csw";
  const JWK_MODULUS = base64ToCircomBigInt(JWK_MODULUS_64);
  const AUD = "866068535821-e9em0h73pee93q4evoajtnnkldsjhqdk.apps.googleusercontent.com";

  this.beforeEach(async () => {
    fixtures = new ContractFixtures();
    ownerWallet = new Wallet(Wallet.createRandom().privateKey, provider);
    oidcValidator = await fixtures.getOidcRecoveryValidator();
    keyRegistry = await fixtures.getOidcKeyRegistryContract();
    factory = await fixtures.getAaFactory();
    webAuthValidator = await fixtures.getWebAuthnVerifierContract();

    // Fund the test wallet
    await (await fixtures.wallet.sendTransaction({
      value: parseEther("0.2"),
      to: ownerWallet.address,
    })).wait();
    await (await fixtures.wallet.sendTransaction({
      value: parseEther("0.2"),
      to: testWallet.address,
    })).wait();
  });

  describe("addValidationKey", () => {
    it("should add new OIDC validation key", async function () {
      // Create test OIDC data
      const oidcData = {
        oidcDigest: ethers.hexlify(randomBytes(32)),
        iss: ethers.toUtf8Bytes("https://accounts.google.com"),
        aud: ethers.toUtf8Bytes("test-client-id"),
        readyToRecover: false,
        pendingPasskeyHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        recoverNonce: 0,
      };

      // Encode the OIDC data
      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32 oidcDigest, bytes iss, bytes aud, bool readyToRecover, bytes32 pendingPasskeyHash, uint256 recoverNonce)"],
        [oidcData],
      );

      // Call addValidationKey
      const tx = await oidcValidator.connect(ownerWallet).addValidationKey(encodedData);
      await tx.wait();

      // Verify the key was added
      const storedData = (await oidcValidator.oidcDataForAddress(ownerWallet.address))[0];

      expect(storedData.oidcDigest).to.equal(oidcData.oidcDigest);
      expect(ethers.toUtf8String(storedData.iss)).to.equal("https://accounts.google.com");
      expect(ethers.toUtf8String(storedData.aud)).to.equal("test-client-id");
      expect(storedData.readyToRecover).to.be.false;
      expect(storedData.pendingPasskeyHash).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
      expect(storedData.recoverNonce).to.equal(0);
    });

    it("should prevent duplicate oidc_digest registration", async function () {
      const oidcData = {
        oidcDigest: ethers.hexlify(randomBytes(32)),
        iss: ethers.toUtf8Bytes("https://accounts.google.com"),
        aud: ethers.toUtf8Bytes("test-client-id"),
        readyToRecover: false,
        pendingPasskeyHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        recoverNonce: 0,
      };

      // Encode the OIDC data
      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32 oidcDigest, bytes iss, bytes aud, bool readyToRecover, bytes32 pendingPasskeyHash, uint256 recoverNonce)"],
        [oidcData],
      );

      // First registration should succeed
      await oidcValidator.connect(ownerWallet).addValidationKey(encodedData);

      // Create another wallet
      const otherWallet = new Wallet(Wallet.createRandom().privateKey, provider);
      await (await fixtures.wallet.sendTransaction({
        value: parseEther("0.2"),
        to: otherWallet.address,
      })).wait();

      // Second registration with same digest should fail
      await expect(
        oidcValidator.connect(otherWallet).addValidationKey(encodedData),
      ).to.be.revertedWith("oidc_digest already registered in other account");
    });
  });

  describe("startRecovery", () => {
    it("should start recovery process", async function () {
      const issuer = "https://google.com";
      const issHash = await keyRegistry.hashIssuer(issuer);

      const key = {
        issHash,
        kid: pad("0x763f7c4cd26a1eb2b1b39a88f4434d1f4d9a368b"),
        n: JWK_MODULUS,
        e: "0x010001",
      };
      await keyRegistry.addKey(key);

      const oidcData = {
        oidcDigest: "0x1F481CE78887D0D19431F98D0990D76044A3AC70DCEC0E620263707F50A5085D",
        iss: ethers.toUtf8Bytes(issuer),
        aud: ethers.toUtf8Bytes(AUD),
        readyToRecover: false,
        pendingPasskeyHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        recoverNonce: 0,
      };

      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32 oidcDigest, bytes iss, bytes aud, bool readyToRecover, bytes32 pendingPasskeyHash, uint256 recoverNonce)"],
        [oidcData],
      );

      await oidcValidator.connect(ownerWallet).addValidationKey(encodedData);

      const keypassPubKey = [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))];
      const keypassPubKeyHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["bytes32[2]"], [keypassPubKey]));

      const startRecoveryData = {
        zkProof: {
          pA: [pad("0x14F02B8CE3A7BC3AE329A6D51E7DFF440578CC8F44D72F25F84AD80978C0E711"), pad("0x248C0907F33A8787B5C1119671499AEBFCB5E0C68D85CE76D703F8E240A7CA61")],
          pB: [
            [pad("0x20F743FB8B59CDC480D5D8B018DDD7301B4C9BD3793D83A76BC42846D2A4ACF8"), pad("0x225CA8A2CE71430D35CA0AB7A177C1F3A0CB92EEC76DE9DB0F02FF4A954A2B66")],
            [pad("0x246FC3E5E6BDC9DE034F6F842D94EF3174624C26309E498354B83117CEC616A6"), pad("0x2C98039374E9BEE6FCA6E3626B44FE625FF937CAEE908DBE6C7BB350A39916D7")],
          ],
          pC: [pad("0xDADA9586808649D1EFF72529C59B89B1D93BE71D99776B86718E5BFC36819BA"), pad("0xEE9F2420F4D7D9E69E135D3943AD5A6BF400CDCAC40EAE8D7F05EC79942DA0D")],
        },
        issHash,
        kid: key.kid,
        pendingPasskeyHash: keypassPubKeyHash,
      };

      const nonce = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "bytes32"], [pad("0x0965204BA4e07863e72a367D1EC2e6aBc20765aC"), "0x0000000000000000000000000000000000000000000000000000000000000000"]));
      console.log("nonce", nonce);
      await oidcValidator.connect(ownerWallet).startRecovery(startRecoveryData, ownerWallet.address);
    });
  });

  describe("validateTransaction", () => {
    xit("should validate transaction", async function () {
      const issuer = "https://example.com";
      const issHash = await keyRegistry.hashIssuer(issuer);

      const key = {
        issHash,
        kid: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        n: JWK_MODULUS,
        e: "0x010001",
      };

      // Add key to registry
      await keyRegistry.addKey(key);

      const keys = Array.from({ length: 8 }, () => [
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        Array(17).fill("0"),
        "0x",
      ]);

      const currentIndex = await keyRegistry.keyIndex();
      const nextIndex = ((currentIndex + 1n) % 8n) as unknown as number;
      keys[nextIndex] = [key.issHash, key.kid, key.n, key.e];

      const tree = StandardMerkleTree.of(keys, ["bytes32", "bytes32", "uint256[17]", "bytes"]);
      const proof = tree.getProof([key.issHash, key.kid, key.n, key.e]);

      const aud = "test-client-id";
      const oidcData = {
        oidcDigest: ethers.hexlify(randomBytes(32)),
        iss: ethers.toUtf8Bytes(issuer),
        aud: ethers.toUtf8Bytes(aud),
      };

      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32 oidcDigest, bytes iss, bytes aud)"],
        [oidcData],
      );

      await oidcValidator.connect(ownerWallet).addValidationKey(encodedData);

      const signature = {
        zkProof: {
          pA: [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
          pB: [
            [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
            [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
          ],
          pC: [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
        },
        key: key,
        merkleProof: proof,
      };

      const encodedSignature = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(tuple(bytes32[2] pA, bytes32[2][2] pB, bytes32[2] pC) zkProof, tuple(bytes32 issHash, bytes32 kid, uint256[17] n, bytes e) key, bytes32[] merkleProof)"],
        [signature],
      );

      const data = webAuthValidator.interface.encodeFunctionData("addValidationKey", ["0x"]);
      const transaction = {
        txType: 0n,
        from: BigInt(ownerWallet.address),
        to: BigInt(await webAuthValidator.getAddress()),
        gasLimit: 0n,
        gasPerPubdataByteLimit: 0n,
        maxFeePerGas: 0n,
        maxPriorityFeePerGas: 0n,
        paymaster: 0n,
        nonce: 0n,
        value: 0n,
        reserved: [0n, 0n, 0n, 0n],
        data,
        signature: "0x01",
        factoryDeps: [],
        paymasterInput: "0x",
        reservedDynamic: "0x",
      };

      // Should not revert
      await oidcValidator.connect(ownerWallet).validateTransaction(
        ethers.hexlify(randomBytes(32)),
        encodedSignature,
        transaction,
      );
    });

    xit("should revert if oidc key is not registered", async function () {
      const issuer = "https://another-example.com";
      const issHash = await keyRegistry.hashIssuer(issuer);

      // Do not add key to registry
      const key = {
        issHash,
        kid: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        n: JWK_MODULUS,
        e: "0x010001",
      };

      const keys = Array.from({ length: 8 }, () => [
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        Array(17).fill("0"),
        "0x",
      ]);

      const currentIndex = await keyRegistry.keyIndex();
      const nextIndex = ((currentIndex + 1n) % 8n) as unknown as number;
      keys[nextIndex] = [key.issHash, key.kid, key.n, key.e];

      const tree = StandardMerkleTree.of(keys, ["bytes32", "bytes32", "uint256[17]", "bytes"]);
      const proof = tree.getProof([key.issHash, key.kid, key.n, key.e]);

      const aud = "test-client-id";
      const oidcData = {
        oidcDigest: ethers.hexlify(randomBytes(32)),
        iss: ethers.toUtf8Bytes(issuer),
        aud: ethers.toUtf8Bytes(aud),
      };

      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32 oidcDigest, bytes iss, bytes aud)"],
        [oidcData],
      );

      await oidcValidator.connect(ownerWallet).addValidationKey(encodedData);

      const signature = {
        zkProof: {
          pA: [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
          pB: [
            [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
            [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
          ],
          pC: [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
        },
        key: key,
        merkleProof: proof,
      };

      const encodedSignature = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(tuple(bytes32[2] pA, bytes32[2][2] pB, bytes32[2] pC) zkProof, tuple(bytes32 issHash, bytes32 kid, uint256[17] n, bytes e) key, bytes32[] merkleProof)"],
        [signature],
      );

      const data = webAuthValidator.interface.encodeFunctionData("addValidationKey", ["0x"]);
      const transaction = {
        txType: 0n,
        from: BigInt(ownerWallet.address),
        to: BigInt(await webAuthValidator.getAddress()),
        gasLimit: 0n,
        gasPerPubdataByteLimit: 0n,
        maxFeePerGas: 0n,
        maxPriorityFeePerGas: 0n,
        paymaster: 0n,
        nonce: 0n,
        value: 0n,
        reserved: [0n, 0n, 0n, 0n],
        data,
        signature: "0x01",
        factoryDeps: [],
        paymasterInput: "0x",
        reservedDynamic: "0x",
      };

      await expect(
        oidcValidator.validateTransaction(
          ethers.hexlify(randomBytes(32)),
          encodedSignature,
          transaction,
        ),
      ).to.be.revertedWith("OidcRecoveryValidator: oidc provider pub key not present in key registry");
    });

    xit("should revert if passkey module address is not valid", async function () {
      const issuer = "https://example.com";
      const issHash = await keyRegistry.hashIssuer(issuer);

      const key = {
        issHash,
        kid: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        n: JWK_MODULUS,
        e: "0x010001",
      };

      // Add key to registry
      await keyRegistry.addKey(key);

      const keys = Array.from({ length: 8 }, () => [
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        Array(17).fill("0"),
        "0x",
      ]);

      const currentIndex = await keyRegistry.keyIndex();
      const nextIndex = ((currentIndex + 1n) % 8n) as unknown as number;
      keys[nextIndex] = [key.issHash, key.kid, key.n, key.e];

      const tree = StandardMerkleTree.of(keys, ["bytes32", "bytes32", "uint256[17]", "bytes"]);
      const proof = tree.getProof([key.issHash, key.kid, key.n, key.e]);

      const aud = "test-client-id";
      const oidcData = {
        oidcDigest: ethers.hexlify(randomBytes(32)),
        iss: ethers.toUtf8Bytes(issuer),
        aud: ethers.toUtf8Bytes(aud),
      };

      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32 oidcDigest, bytes iss, bytes aud)"],
        [oidcData],
      );

      await oidcValidator.connect(ownerWallet).addValidationKey(encodedData);

      const signature = {
        zkProof: {
          pA: [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
          pB: [
            [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
            [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
          ],
          pC: [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
        },
        key: key,
        merkleProof: proof,
      };

      const encodedSignature = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(tuple(bytes32[2] pA, bytes32[2][2] pB, bytes32[2] pC) zkProof, tuple(bytes32 issHash, bytes32 kid, uint256[17] n, bytes e) key, bytes32[] merkleProof)"],
        [signature],
      );

      const data = webAuthValidator.interface.encodeFunctionData("addValidationKey", ["0x"]);

      const transaction = {
        txType: 0n,
        from: BigInt(ownerWallet.address),
        to: BigInt(ownerWallet.address),
        gasLimit: 0n,
        gasPerPubdataByteLimit: 0n,
        maxFeePerGas: 0n,
        maxPriorityFeePerGas: 0n,
        paymaster: 0n,
        nonce: 0n,
        value: 0n,
        reserved: [0n, 0n, 0n, 0n],
        data,
        signature: "0x01",
        factoryDeps: [],
        paymasterInput: "0x",
        reservedDynamic: "0x",
      };

      await expect(
        oidcValidator.connect(ownerWallet).validateTransaction(
          ethers.hexlify(randomBytes(32)),
          encodedSignature,
          transaction,
        ),
      ).to.be.revertedWith("OidcRecoveryValidator: invalid webauthn validator address");
    });

    xit("should revert with invalid transaction data", async function () {
      const issuer = "https://example.com";
      const issHash = await keyRegistry.hashIssuer(issuer);

      const key = {
        issHash,
        kid: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        n: JWK_MODULUS,
        e: "0x010001",
      };

      // Add key to registry
      await keyRegistry.addKey(key);

      const keys = Array.from({ length: 8 }, () => [
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        Array(17).fill("0"),
        "0x",
      ]);

      const currentIndex = await keyRegistry.keyIndex();
      const nextIndex = ((currentIndex + 1n) % 8n) as unknown as number;
      keys[nextIndex] = [key.issHash, key.kid, key.n, key.e];

      const tree = StandardMerkleTree.of(keys, ["bytes32", "bytes32", "uint256[17]", "bytes"]);
      const proof = tree.getProof([key.issHash, key.kid, key.n, key.e]);

      const aud = "test-client-id";
      const oidcData = {
        oidcDigest: ethers.hexlify(randomBytes(32)),
        iss: ethers.toUtf8Bytes(issuer),
        aud: ethers.toUtf8Bytes(aud),
      };

      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32 oidcDigest, bytes iss, bytes aud)"],
        [oidcData],
      );

      await oidcValidator.connect(ownerWallet).addValidationKey(encodedData);

      const signature = {
        zkProof: {
          pA: [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
          pB: [
            [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
            [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
          ],
          pC: [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
        },
        key: key,
        merkleProof: proof,
      };

      const encodedSignature = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(tuple(bytes32[2] pA, bytes32[2][2] pB, bytes32[2] pC) zkProof, tuple(bytes32 issHash, bytes32 kid, uint256[17] n, bytes e) key, bytes32[] merkleProof)"],
        [signature],
      );

      const transaction = {
        txType: 0n,
        from: BigInt(ownerWallet.address),
        to: BigInt(await webAuthValidator.getAddress()),
        gasLimit: 0n,
        gasPerPubdataByteLimit: 0n,
        maxFeePerGas: 0n,
        maxPriorityFeePerGas: 0n,
        paymaster: 0n,
        nonce: 0n,
        value: 0n,
        reserved: [0n, 0n, 0n, 0n],
        data: "0x",
        signature: "0x01",
        factoryDeps: [],
        paymasterInput: "0x",
        reservedDynamic: "0x",
      };

      await expect(
        oidcValidator.connect(ownerWallet).validateTransaction(
          ethers.hexlify(randomBytes(32)),
          encodedSignature,
          transaction,
        ),
      ).to.be.revertedWith("Only function calls are supported");
    });

    xit("should revert with invalid transaction function selector", async function () {
      const issuer = "https://example.com";
      const issHash = await keyRegistry.hashIssuer(issuer);

      const key = {
        issHash,
        kid: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        n: JWK_MODULUS,
        e: "0x010001",
      };

      // Add key to registry
      await keyRegistry.addKey(key);

      const keys = Array.from({ length: 8 }, () => [
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        Array(17).fill("0"),
        "0x",
      ]);

      const currentIndex = await keyRegistry.keyIndex();
      const nextIndex = ((currentIndex + 1n) % 8n) as unknown as number;
      keys[nextIndex] = [key.issHash, key.kid, key.n, key.e];

      const tree = StandardMerkleTree.of(keys, ["bytes32", "bytes32", "uint256[17]", "bytes"]);
      const proof = tree.getProof([key.issHash, key.kid, key.n, key.e]);

      const aud = "test-client-id";
      const oidcData = {
        oidcDigest: ethers.hexlify(randomBytes(32)),
        iss: ethers.toUtf8Bytes(issuer),
        aud: ethers.toUtf8Bytes(aud),
      };

      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32 oidcDigest, bytes iss, bytes aud)"],
        [oidcData],
      );

      await oidcValidator.connect(ownerWallet).addValidationKey(encodedData);

      const signature = {
        zkProof: {
          pA: [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
          pB: [
            [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
            [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
          ],
          pC: [ethers.hexlify(randomBytes(32)), ethers.hexlify(randomBytes(32))],
        },
        key: key,
        merkleProof: proof,
      };

      const encodedSignature = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(tuple(bytes32[2] pA, bytes32[2][2] pB, bytes32[2] pC) zkProof, tuple(bytes32 issHash, bytes32 kid, uint256[17] n, bytes e) key, bytes32[] merkleProof)"],
        [signature],
      );

      const data = webAuthValidator.interface.encodeFunctionData("validateSignature", [ethers.hexlify(randomBytes(32)), "0x"]);
      const transaction = {
        txType: 0n,
        from: BigInt(ownerWallet.address),
        to: BigInt(await webAuthValidator.getAddress()),
        gasLimit: 0n,
        gasPerPubdataByteLimit: 0n,
        maxFeePerGas: 0n,
        maxPriorityFeePerGas: 0n,
        paymaster: 0n,
        nonce: 0n,
        value: 0n,
        reserved: [0n, 0n, 0n, 0n],
        data,
        signature: "0x01",
        factoryDeps: [],
        paymasterInput: "0x",
        reservedDynamic: "0x",
      };

      await expect(
        oidcValidator.connect(ownerWallet).validateTransaction(
          ethers.hexlify(randomBytes(32)),
          encodedSignature,
          transaction,
        ),
      ).to.be.revertedWith("OidcRecoveryValidator: Unauthorized function call");
    });
  });
});
