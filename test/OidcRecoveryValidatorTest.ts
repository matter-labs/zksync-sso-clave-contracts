import { expect } from "chai";
import { randomBytes } from "crypto";
import { ethers } from "ethers";
import { parseEther } from "viem";
import { Provider, SmartAccount, Wallet } from "zksync-ethers";

import { AAFactory, OidcKeyRegistry, OidcRecoveryValidator, WebAuthValidator } from "../typechain-types";
import { base64ToCircomBigInt, cacheBeforeEach, ContractFixtures, getProvider } from "./utils";

describe("OidcRecoveryValidator", function () {
  const fixtures = new ContractFixtures();
  const provider = getProvider();
  let oidcValidatorAddr: string;
  let factory: AAFactory;
  let oidcValidator: OidcRecoveryValidator;
  let keyRegistry: OidcKeyRegistry;
  let ownerWallet: Wallet;
  const JWK_MODULUS_64 = "y8TPCPz2Fp0OhBxsxu6d_7erT9f9XJ7mx7ZJPkkeZRxhdnKtg327D4IGYsC4fLAfpkC8qN58sZGkwRTNs-i7yaoD5_8nupq1tPYvnt38ddVghG9vws-2MvxfPQ9m2uxBEdRHmels8prEYGCH6oFKcuWVsNOt4l_OPoJRl4uiuiwd6trZik2GqDD_M6bn21_w6AD_jmbzN4mh8Od4vkA1Z9lKb3Qesksxdog-LWHsljN8ieiz1NhbG7M-GsIlzu-typJfud3tSJ1QHb-E_dEfoZ1iYK7pMcojb5ylMkaCj5QySRdJESq9ngqVRDjF4nX8DK5RQUS7AkrpHiwqyW0Csw";
  const JWK_MODULUS = base64ToCircomBigInt(JWK_MODULUS_64);

  cacheBeforeEach(async () => {
    ownerWallet = new Wallet(Wallet.createRandom().privateKey, provider);

    oidcValidator = await fixtures.getOidcRecoveryValidator();
    keyRegistry = await fixtures.getOidcKeyRegistryContract();
    oidcValidatorAddr = await oidcValidator.getAddress();
    factory = await fixtures.getAaFactory();

    // Fund the test wallet
    await (await fixtures.wallet.sendTransaction({
      value: parseEther("0.2"),
      to: ownerWallet.address,
    })).wait();
  });

  describe("addValidationKey", () => {
    it("should add new OIDC validation key", async function () {
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

    it("should prevent duplicate oidc_digest registration", async function () {
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
});
