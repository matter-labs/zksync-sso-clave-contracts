import { expect } from "chai";
import { randomBytes } from "crypto";
import { ethers } from "ethers";
import { parseEther } from "viem";
import { Provider, SmartAccount, Wallet } from "zksync-ethers";

import { AAFactory, OidcRecoveryValidator, OidcKeyRegistry, WebAuthValidator } from "../typechain-types";
import { cacheBeforeEach, ContractFixtures, getProvider } from "./utils";

describe("OidcRecoveryValidator", function () {
  const fixtures = new ContractFixtures();
  const provider = getProvider();
  let oidcValidatorAddr: string;
  let factory: AAFactory;
  let oidcValidator: OidcRecoveryValidator;
  let keyRegistry: OidcKeyRegistry;
  let webauthn: WebAuthValidator;
  let ownerWallet: Wallet;
  let proofInputs: JwtTxValidationInputs;

  cacheBeforeEach(async () => {
    ownerWallet = new Wallet(Wallet.createRandom().privateKey, provider);
    
    oidcValidator = await fixtures.getOidcRecoveryValidator();
    keyRegistry = await fixtures.getOidcKeyRegistryContract();
    webauthn = await fixtures.getWebAuthnVerifierContract();
    oidcValidatorAddr = await oidcValidator.getAddress();
    factory = await fixtures.getAaFactory();

    // Fund the test wallet
    await (await fixtures.wallet.sendTransaction({ 
      value: parseEther("0.2"), 
      to: ownerWallet.address 
    })).wait();
  });

  describe("addValidationKey", () => {
    it("should add new OIDC validation key", async function () {
      // Create test OIDC data
      const oidcData = {
        oidcDigest: ethers.hexlify(randomBytes(32)),
        iss: ethers.toUtf8Bytes("https://accounts.google.com"),
        aud: ethers.toUtf8Bytes("test-client-id")
      };

      // Encode the OIDC data
      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32 oidcDigest, bytes iss, bytes aud)"],
        [oidcData]
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

    it("should prevent duplicate oidc_digest registration", async function () {
      const oidcData = {
        oidcDigest: ethers.hexlify(randomBytes(32)),
        iss: ethers.toUtf8Bytes("https://accounts.google.com"),
        aud: ethers.toUtf8Bytes("test-client-id")
      };

      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32 oidcDigest, bytes iss, bytes aud)"],
        [oidcData]
      );

      // First registration should succeed
      await oidcValidator.connect(ownerWallet).addValidationKey(encodedData);

      // Create another wallet
      const otherWallet = new Wallet(Wallet.createRandom().privateKey, provider);
      await (await fixtures.wallet.sendTransaction({ 
        value: parseEther("0.2"), 
        to: otherWallet.address 
      })).wait();

      // Second registration with same digest should fail
      await expect(
        oidcValidator.connect(otherWallet).addValidationKey(encodedData)
      ).to.be.revertedWith("oidc_digest already registered in other account");
    });
  });

  describe("encodePubKeyForCircom", () => {
    it("should match TypeScript reference implementation", async function () {
      // Test value (example RSA modulus)
      const testValue = 123456789123456789123456789123456789123456789123456789123456789123456789123456789n;
      
      // Get reference result
      const expectedChunks = referenceSerialize(testValue);
      
      // Convert bigint to bytes for Solidity function
      const bytes = ethers.toBeArray(testValue);
      
      // Call Solidity implementation
      const actualChunks = await oidcValidator.encodePubKeyForCircom(bytes);
      
      // Compare results
      for (let i = 0; i < 17; i++) {
        expect(actualChunks[i].toString()).to.equal(
          expectedChunks[i],
          `Chunk ${i} mismatch`
        );
      }
    });

    it("should handle max values", async function () {
      // Create a value with all bits set to 1 for max value testing
      const maxBits = 121n * 17n; // Total bits we're encoding
      const testValue = (1n << maxBits) - 1n;
      
      const expectedChunks = referenceSerialize(testValue);
      const bytes = ethers.toBeArray(testValue);
      const actualChunks = await oidcValidator.encodePubKeyForCircom(bytes);
      
      for (let i = 0; i < 17; i++) {
        expect(actualChunks[i].toString()).to.equal(
          expectedChunks[i],
          `Max value chunk ${i} mismatch`
        );
      }
    });

    it("should handle zero value", async function () {
      const testValue = 0n;
      const expectedChunks = referenceSerialize(testValue);
      const bytes = ethers.toBeArray(testValue);
      const actualChunks = await oidcValidator.encodePubKeyForCircom(bytes);
      
      for (let i = 0; i < 17; i++) {
        expect(actualChunks[i].toString()).to.equal(
          expectedChunks[i],
          `Zero value chunk ${i} mismatch`
        );
      }
    });
  });
});
