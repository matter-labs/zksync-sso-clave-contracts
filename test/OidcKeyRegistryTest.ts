import { expect } from "chai";
import { ethers } from "ethers";
import { Wallet } from "zksync-ethers";

import { OidcKeyRegistry, OidcKeyRegistry__factory } from "../typechain-types";
import { base64ToCircomBigInt, ContractFixtures, getProvider } from "./utils";

describe("OidcKeyRegistry", function () {
  let fixtures: ContractFixtures;
  let oidcKeyRegistry: OidcKeyRegistry;
  const JWK_MODULUS_64 = "y8TPCPz2Fp0OhBxsxu6d_7erT9f9XJ7mx7ZJPkkeZRxhdnKtg327D4IGYsC4fLAfpkC8qN58sZGkwRTNs-i7yaoD5_8nupq1tPYvnt38ddVghG9vws-2MvxfPQ9m2uxBEdRHmels8prEYGCH6oFKcuWVsNOt4l_OPoJRl4uiuiwd6trZik2GqDD_M6bn21_w6AD_jmbzN4mh8Od4vkA1Z9lKb3Qesksxdog-LWHsljN8ieiz1NhbG7M-GsIlzu-typJfud3tSJ1QHb-E_dEfoZ1iYK7pMcojb5ylMkaCj5QySRdJESq9ngqVRDjF4nX8DK5RQUS7AkrpHiwqyW0Csw";
  const JWK_MODULUS = base64ToCircomBigInt(JWK_MODULUS_64);
  const JWK_MODULUS_2_64 = "0qTcwnqUqJqsyu57JAC4IOAgTuMrccabAKKj5T93F68NoCk4kAax0oJhDArisYpiLrQ__YJJ9HFm3TKkuiPZeb1xqSSXAnIZVo8UigTLQDQLCTq3O-aD5EyQTOhOHWxJBZcpyLO-dZVuOIbv8fNMcXpNCioHVHO04gI_mvaw8ZzbU_j8ZeHSPk4wTBNfmH4l0mYRDhoQHLkZxxvc2V71ppBPYbnX-4t6h7XcuTkLJKBxfrR43G5nNzDuFsIbBnS2fjVLEv_1LYj9G5Q5XwiCFS0BON-oqQNzRWF53nkf91bMm2TaROg21KKJbZqfEjUhCVlMDFmBW-MNv69-C19PZQ";
  const JWK_MODULUS_2 = base64ToCircomBigInt(JWK_MODULUS_2_64);

  this.beforeEach(async () => {
    fixtures = new ContractFixtures();
    oidcKeyRegistry = await fixtures.getOidcKeyRegistryContract();
  });

  it("should return empty key when fetching a non-existent key", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const nonExistentKid = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    await expect(oidcKeyRegistry.getKey(issHash, nonExistentKid)).to.be.revertedWith("Key not found");
  });

  it("should set one key", async () => {
    const keys = Array.from({ length: 8 }, () => [
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      Array(17).fill("0"),
      "0x",
    ]);

    const currentIndex = await oidcKeyRegistry.keyIndex();
    const nextIndex = ((currentIndex + 1n) % 8n) as unknown as number;

    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);

    const key = {
      issHash,
      kid: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      n: JWK_MODULUS,
      e: "0x010001",
    };

    await oidcKeyRegistry.addKey(key);

    const storedKey = await oidcKeyRegistry.getKey(issHash, key.kid);
    expect(storedKey.kid).to.equal(key.kid);
    const expectedN = key.n.map((n) => BigInt(n));
    expect(storedKey.n).to.deep.equal(expectedN);
    expect(storedKey.e).to.equal(key.e);
  });

  it("should set multiple keys", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const newKeys = Array.from({ length: 8 }, (_, i) => ({
      issHash,
      kid: ethers.keccak256(ethers.toUtf8Bytes(`key${i + 1}`)),
      n: JWK_MODULUS,
      e: "0x010001",
    }));

    await oidcKeyRegistry.addKeys(newKeys);

    for (let i = 0; i < 8; i++) {
      const storedKey = await oidcKeyRegistry.getKey(issHash, newKeys[i].kid);
      expect(storedKey.kid).to.equal(newKeys[i].kid);
    }
  });

  it("should revert when a non-owner tries to set a key", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const key = {
      issHash,
      kid: "0x3333333333333333333333333333333333333333333333333333333333333333",
      n: JWK_MODULUS,
      e: "0x010001",
    };

    const nonOwner = Wallet.createRandom(getProvider());
    const nonOwnerRegistry = OidcKeyRegistry__factory.connect(await oidcKeyRegistry.getAddress(), nonOwner);

    await expect(nonOwnerRegistry.addKey(key)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should correctly implement circular key storage", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);

    const keys = Array.from({ length: 8 }, (_, i) => ({
      issHash,
      kid: ethers.keccak256(ethers.toUtf8Bytes(`key${i + 1}`)),
      n: JWK_MODULUS,
      e: "0x010001",
    }));

    await oidcKeyRegistry.addKeys(keys);

    // Check that the keys are stored correctly
    for (let i = 0; i < 8; i++) {
      const storedKey = await oidcKeyRegistry.getKey(issHash, keys[i].kid);
      expect(storedKey.kid).to.equal(keys[i].kid);
    }

    const moreKeys = Array.from({ length: 8 }, (_, i) => ({
      issHash,
      kid: ethers.keccak256(ethers.toUtf8Bytes(`key${i + 9}`)),
      n: JWK_MODULUS,
      e: "0x010001",
    }));

    await oidcKeyRegistry.addKeys(moreKeys);

    // Check that the new keys are stored correctly
    for (let i = 0; i < 8; i++) {
      const storedKey = await oidcKeyRegistry.getKey(issHash, moreKeys[i].kid);
      expect(storedKey.kid).to.equal(moreKeys[i].kid);
    }

    // Check that the old keys are not stored anymore
    for (let i = 0; i < 8; i++) {
      await expect(oidcKeyRegistry.getKey(issHash, keys[i].kid)).to.be.revertedWith("Key not found");
    }
  });
});
