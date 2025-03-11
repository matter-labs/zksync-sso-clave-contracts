import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { expect } from "chai";
import { randomBytes } from "crypto";
import { ethers } from "ethers";
import { parseEther, zeroAddress } from "viem";
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
  const JWK_MODULUS_64 = "y8TPCPz2Fp0OhBxsxu6d_7erT9f9XJ7mx7ZJPkkeZRxhdnKtg327D4IGYsC4fLAfpkC8qN58sZGkwRTNs-i7yaoD5_8nupq1tPYvnt38ddVghG9vws-2MvxfPQ9m2uxBEdRHmels8prEYGCH6oFKcuWVsNOt4l_OPoJRl4uiuiwd6trZik2GqDD_M6bn21_w6AD_jmbzN4mh8Od4vkA1Z9lKb3Qesksxdog-LWHsljN8ieiz1NhbG7M-GsIlzu-typJfud3tSJ1QHb-E_dEfoZ1iYK7pMcojb5ylMkaCj5QySRdJESq9ngqVRDjF4nX8DK5RQUS7AkrpHiwqyW0Csw";
  const JWK_MODULUS = base64ToCircomBigInt(JWK_MODULUS_64);

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
  });

  describe("addValidationKey", () => {
    xit("should add new OIDC validation key", async function () {
      // Create test OIDC data
      const oidcData = {
        oidcDigest: ethers.hexlify(randomBytes(32)),
        iss: ethers.toUtf8Bytes("https://accounts.google.com"),
        aud: ethers.toUtf8Bytes("test-client-id"),
      };

      // Encode the OIDC data
      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32 oidcDigest, bytes iss, bytes aud)"],
        [oidcData],
      );

      // Call addValidationKey
      const tx = await oidcValidator.connect(ownerWallet).addValidationKey(encodedData);
      await tx.wait();

      // Verify the key was added
      const storedData = await oidcValidator.accountData(ownerWallet.address);

      expect(storedData.oidcDigest).to.equal(oidcData.oidcDigest);
      expect(ethers.toUtf8String(storedData.iss)).to.equal("https://accounts.google.com");
      expect(ethers.toUtf8String(storedData.aud)).to.equal("test-client-id");
    });

    xit("should prevent duplicate oidc_digest registration", async function () {
      const oidcData = {
        oidcDigest: ethers.hexlify(randomBytes(32)),
        iss: ethers.toUtf8Bytes("https://accounts.google.com"),
        aud: ethers.toUtf8Bytes("test-client-id"),
      };

      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32 oidcDigest, bytes iss, bytes aud)"],
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
