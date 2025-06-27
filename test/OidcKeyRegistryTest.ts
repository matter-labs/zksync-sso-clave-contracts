import { expect } from "chai";
import { ethers } from "ethers";
import { hexToBigInt, numberToHex, pad } from "viem";
import { Wallet } from "zksync-ethers";

import { OidcKeyRegistry, OidcKeyRegistry__factory } from "../typechain-types";
import { base64ToCircomBigInt, ContractFixtures, getProvider } from "./utils";

describe("OidcKeyRegistry", function () {
  let fixtures: ContractFixtures;
  let oidcKeyRegistry: OidcKeyRegistry;
  const JWK_MODULUS_64 = "y8TPCPz2Fp0OhBxsxu6d_7erT9f9XJ7mx7ZJPkkeZRxhdnKtg327D4IGYsC4fLAfpkC8qN58sZGkwRTNs-i7yaoD5_8nupq1tPYvnt38ddVghG9vws-2MvxfPQ9m2uxBEdRHmels8prEYGCH6oFKcuWVsNOt4l_OPoJRl4uiuiwd6trZik2GqDD_M6bn21_w6AD_jmbzN4mh8Od4vkA1Z9lKb3Qesksxdog-LWHsljN8ieiz1NhbG7M-GsIlzu-typJfud3tSJ1QHb-E_dEfoZ1iYK7pMcojb5ylMkaCj5QySRdJESq9ngqVRDjF4nX8DK5RQUS7AkrpHiwqyW0Csw";
  const JWK_MODULUS = base64ToCircomBigInt(JWK_MODULUS_64);
  const JWK_MODULUS2 = base64ToCircomBigInt("up_Ts3ztawVy5mKB9fFwdj_AtqtYWWLh_feqL-PGY7aMF0DXpw0su6g90nvp-ODLSbc4OJac7iNYcJ2Fk_25nWqDLAC_LiRClSkfQXMTPQPl3jFs8jaDHxLjM_jOXacTxnWxFFFfUTBvz5p5GrmH504nfNAmNTvrUEJFlYHOG8TF3TbgD4h7MzZDjGCYvfcO47BVMLBPflX4fSYD6QHaYlrdwXUyMwjwaoVHxFaK4_T_MScjPEER3JrS26Dd9kzmzMRX0Dy49HHCtX7NYedHSDf51uRmVSNXefJYp1_RbPwi7U40dY57ufuqxXcihTmmZvKUHpfxHJRBXktgkD2RFQ");

  this.beforeEach(async () => {
    fixtures = new ContractFixtures();
    oidcKeyRegistry = await fixtures.getOidcKeyRegistryContract();
  });

  it("should revert when fetching a non-existent key", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const nonExistentKid = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    await expect(oidcKeyRegistry.getKey(issHash, nonExistentKid))
      .to.be.revertedWithCustomError(oidcKeyRegistry, "OIDC_KEY_NOT_FOUND")
      .withArgs(issHash, nonExistentKid);
  });

  it("should set one key", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);

    const key = {
      issHash,
      kid: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      rsaModulus: JWK_MODULUS,
    };

    await expect(oidcKeyRegistry.addKey(key))
      .to.emit(oidcKeyRegistry, "KeyAdded")
      .withArgs(issHash, key.kid, key.rsaModulus);

    const storedKey = await oidcKeyRegistry.getKey(issHash, key.kid);
    expect(storedKey.kid).to.equal(key.kid);
    const expectedN = key.rsaModulus.map((n) => BigInt(n));
    expect(storedKey.rsaModulus).to.deep.equal(expectedN);
  });

  it("saves first key in first slot", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);

    const key = {
      issHash,
      kid: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      rsaModulus: JWK_MODULUS,
    };
    await oidcKeyRegistry.addKey(key);

    const [first, ...rest] = await oidcKeyRegistry.getKeys(issHash);
    expect(first.kid).equal(key.kid);

    for (const zeroKey of rest) {
      expect(BigInt(zeroKey.kid)).equal(0n);
    }
  });

  it("multiple keys are saved in adjacent slots", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);

    const key1 = {
      issHash,
      kid: pad("0x01"),
      rsaModulus: JWK_MODULUS,
    };
    const key2 = {
      issHash,
      kid: pad("0x02"),
      rsaModulus: JWK_MODULUS,
    };
    const key3 = {
      issHash,
      kid: pad("0x03"),
      rsaModulus: JWK_MODULUS,
    };
    await oidcKeyRegistry.addKey(key1);
    await oidcKeyRegistry.addKey(key2);
    await oidcKeyRegistry.addKey(key3);

    const [first, second, third, ...rest] = await oidcKeyRegistry.getKeys(issHash);
    expect(first.kid).equal(key1.kid);
    expect(second.kid).equal(key2.kid);
    expect(third.kid).equal(key3.kid);

    for (const zeroKey of rest) {
      expect(BigInt(zeroKey.kid)).equal(0n);
    }
  });

  it("should set multiple keys", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const newKeys = Array.from({ length: 8 }, (_, i) => ({
      issHash,
      kid: ethers.keccak256(ethers.toUtf8Bytes(`key${i + 1}`)),
      rsaModulus: JWK_MODULUS,
    }));

    for (let i = 0; i < newKeys.length; i++) {
      await expect(oidcKeyRegistry.addKeys([newKeys[i]]))
        .to.emit(oidcKeyRegistry, "KeyAdded")
        .withArgs(issHash, newKeys[i].kid, newKeys[i].rsaModulus);
    }

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
      rsaModulus: JWK_MODULUS,
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
      kid: pad(numberToHex(i + 1)),
      rsaModulus: JWK_MODULUS,
    }));

    await oidcKeyRegistry.addKeys(keys);

    // Check that the keys are stored correctly
    for (let i = 0; i < 8; i++) {
      const storedKey = await oidcKeyRegistry.getKey(issHash, keys[i].kid);
      expect(storedKey.kid).to.equal(keys[i].kid);
    }

    const moreKeys = Array.from({ length: 8 }, (_, i) => ({
      issHash,
      kid: pad(numberToHex(i + 9)),
      rsaModulus: JWK_MODULUS,
    }));

    await oidcKeyRegistry.addKeys(moreKeys);

    // Check that the new keys are stored correctly
    for (let i = 0; i < 8; i++) {
      const storedKey = await oidcKeyRegistry.getKey(issHash, moreKeys[i].kid);
      expect(storedKey.kid).to.equal(moreKeys[i].kid);
    }

    // Check that the old keys are not stored anymore
    for (let i = 0; i < 8; i++) {
      await expect(oidcKeyRegistry.getKey(issHash, keys[i].kid))
        .to.be.revertedWithCustomError(oidcKeyRegistry, "OIDC_KEY_NOT_FOUND")
        .withArgs(issHash, keys[i].kid);
    }
  });

  it("should correctly implement circular key storage with multiple issuers", async () => {
    const issuers = ["https://issuer1.com", "https://issuer2.com"];
    const keysPerIssuer = 8;

    for (const issuer of issuers) {
      const issHash = await oidcKeyRegistry.hashIssuer(issuer);
      const keys = Array.from({ length: keysPerIssuer }, (_, i) => ({
        issHash,
        kid: ethers.keccak256(ethers.toUtf8Bytes(`key${i + 1}-${issuer}`)),
        rsaModulus: JWK_MODULUS,
      }));

      await oidcKeyRegistry.addKeys(keys);

      for (let i = 0; i < keysPerIssuer; i++) {
        const storedKey = await oidcKeyRegistry.getKey(issHash, keys[i].kid);
        expect(storedKey.kid).to.equal(keys[i].kid);
      }
    }

    const nonExistentKid = ethers.keccak256(ethers.toUtf8Bytes(`key1-${issuers[1]}`));
    const firstIssuerHash = await oidcKeyRegistry.hashIssuer(issuers[0]);
    await expect(oidcKeyRegistry.getKey(firstIssuerHash, nonExistentKid))
      .to.be.revertedWithCustomError(oidcKeyRegistry, "OIDC_KEY_NOT_FOUND")
      .withArgs(firstIssuerHash, nonExistentKid);
  });

  it("should revert when trying to add too many keys", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);

    const keys = Array.from({ length: 9 }, (_, i) => ({
      issHash,
      kid: ethers.keccak256(ethers.toUtf8Bytes(`key${i + 1}`)),
      rsaModulus: JWK_MODULUS,
    }));

    await expect(oidcKeyRegistry.addKeys(keys))
      .to.be.revertedWithCustomError(oidcKeyRegistry, "OIDC_KEY_COUNT_LIMIT_EXCEEDED")
      .withArgs(9);
  });

  it("should revert when adding two different issuers", async () => {
    const issuers = ["https://issuer1.com", "https://issuer2.com"];
    const keysPerIssuer = 4; // Adding the limit for 2 issuers
    const allKeys: { issHash: string; kid: string; rsaModulus: string[] }[] = [];

    for (const issuer of issuers) {
      const issHash = await oidcKeyRegistry.hashIssuer(issuer);
      const keys = Array.from({ length: keysPerIssuer }, (_, i) => ({
        issHash,
        kid: ethers.keccak256(ethers.toUtf8Bytes(`key${i + 1}-${issuer}`)),
        rsaModulus: JWK_MODULUS,
      }));
      allKeys.push(...keys);
    }

    await expect(oidcKeyRegistry.addKeys(allKeys))
      .to.be.revertedWithCustomError(oidcKeyRegistry, "OIDC_ISSUER_HASH_MISMATCH")
      .withArgs(allKeys[0].issHash, allKeys[4].issHash);
  });

  it("should revert when adding a key with a zero modulus", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const kid = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const key = {
      issHash,
      kid,
      rsaModulus: base64ToCircomBigInt(""),
    };

    await expect(oidcKeyRegistry.addKey(key))
      .to.be.revertedWithCustomError(oidcKeyRegistry, "OIDC_ZERO_MODULUS")
      .withArgs(kid);
  });

  it("should revert when adding a key with a zero kid", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const key = {
      issHash,
      kid: "0x0000000000000000000000000000000000000000000000000000000000000000",
      rsaModulus: JWK_MODULUS,
    };

    await expect(oidcKeyRegistry.addKey(key))
      .to.be.revertedWithCustomError(oidcKeyRegistry, "OIDC_ZERO_KEY_ID")
      .withArgs(0);
  });

  it("reverts when adding a repeated kid", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);

    const key = {
      issHash,
      kid: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      rsaModulus: JWK_MODULUS,
    };
    await oidcKeyRegistry.addKey(key);

    const key2 = {
      issHash,
      kid: key.kid,
      rsaModulus: JWK_MODULUS,
    };

    await expect(oidcKeyRegistry.addKey(key2)).to.revertedWithCustomError(
      oidcKeyRegistry,
      "OIDC_KEY_ID_ALREADY_EXISTS",
    ).withArgs(key2.kid, key2.issHash);
  });

  it("reverts when adding a repeated kid in the same tx", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);

    const kid = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const key1 = {
      issHash,
      kid,
      rsaModulus: JWK_MODULUS,
    };
    const key2 = {
      issHash,
      kid,
      rsaModulus: JWK_MODULUS2,
    };

    await expect(oidcKeyRegistry.addKeys([key1, key2])).to.revertedWithCustomError(
      oidcKeyRegistry,
      "OIDC_KEY_ID_ALREADY_EXISTS",
    ).withArgs(key2.kid, key2.issHash);
  });

  it("reverts if an even modulus is added", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);

    const modulus = hexToBigInt(`0x${Buffer.from(JWK_MODULUS_64, "base64url").toString("hex")}`);
    const evenModulus = modulus - modulus % 2n;
    const serializedEvenModulus = base64ToCircomBigInt(
      Buffer.from(evenModulus.toString(16), "hex").toString("base64url"),
    );

    const kid = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const key = {
      issHash,
      kid,
      rsaModulus: serializedEvenModulus,
    };

    await expect(oidcKeyRegistry.addKeys([key])).to.revertedWithCustomError(
      oidcKeyRegistry,
      "OIDC_EVEN_RSA_MODULUS",
    ).withArgs(kid);
  });

  it("should revert when adding a key with a modulus chunk too large", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const rsaModulus = [...JWK_MODULUS];
    rsaModulus[2] += 1 << 121;
    const kid = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const key = {
      issHash,
      kid,
      rsaModulus,
    };

    await expect(oidcKeyRegistry.addKey(key))
      .to.be.revertedWithCustomError(oidcKeyRegistry, "OIDC_MODULUS_CHUNK_TOO_LARGE")
      .withArgs(kid, 2, rsaModulus[2]);
  });

  it("should remove a key", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const kid = ethers.keccak256(ethers.toUtf8Bytes("key1"));
    const key = {
      issHash,
      kid,
      rsaModulus: JWK_MODULUS,
    };

    await oidcKeyRegistry.addKey(key);
    await expect(oidcKeyRegistry.deleteKey(issHash, kid)).to.emit(oidcKeyRegistry, "KeyDeleted").withArgs(issHash, kid);

    await expect(oidcKeyRegistry.getKey(issHash, kid))
      .to.be.revertedWithCustomError(oidcKeyRegistry, "OIDC_KEY_NOT_FOUND")
      .withArgs(issHash, kid);
  });

  it("should revert when a non-owner tries to remove a key", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const kid = ethers.keccak256(ethers.toUtf8Bytes("key1"));
    const key = {
      issHash,
      kid,
      rsaModulus: JWK_MODULUS,
    };

    await oidcKeyRegistry.addKey(key);

    const nonOwner = Wallet.createRandom(getProvider());
    const nonOwnerRegistry = OidcKeyRegistry__factory.connect(await oidcKeyRegistry.getAddress(), nonOwner);

    await expect(nonOwnerRegistry.deleteKey(issHash, kid)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should revert when trying to remove a non-existent key", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const nonExistentKid = ethers.keccak256(ethers.toUtf8Bytes("key1"));

    await expect(oidcKeyRegistry.deleteKey(issHash, nonExistentKid))
      .to.be.revertedWithCustomError(oidcKeyRegistry, "OIDC_KEY_NOT_FOUND")
      .withArgs(issHash, nonExistentKid);
  });

  it("should remove holes when removing keys", async () => {
    const iss = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(iss);
    const keys = Array.from({ length: 8 }, (_, i) => ({
      issHash,
      kid: pad(numberToHex(i + 1)),
      rsaModulus: JWK_MODULUS,
    }));

    await oidcKeyRegistry.addKeys(keys);

    // Remove the first two keys
    for (let i = 0; i < 2; i++) {
      await expect(oidcKeyRegistry.deleteKey(issHash, keys[i].kid)).to.emit(oidcKeyRegistry, "KeyDeleted").withArgs(issHash, keys[i].kid);
    }

    // Check that the removed keys are not stored anymore
    for (let i = 0; i < 2; i++) {
      await expect(oidcKeyRegistry.getKey(issHash, keys[i].kid))
        .to.be.revertedWithCustomError(oidcKeyRegistry, "OIDC_KEY_NOT_FOUND")
        .withArgs(issHash, keys[i].kid);
    }

    // Check that the other keys are still stored
    for (let i = 2; i < 8; i++) {
      const storedKey = await oidcKeyRegistry.getKey(issHash, keys[i].kid);
      expect(storedKey.kid).to.equal(keys[i].kid);
    }

    // Add two new keys
    const newKeys = Array.from({ length: 2 }, (_, i) => ({
      issHash,
      kid: pad(numberToHex(i + 9)),
      rsaModulus: JWK_MODULUS,
    }));

    await oidcKeyRegistry.addKeys(newKeys);

    // Check that the new keys are stored correctly
    for (let i = 0; i < 2; i++) {
      const storedKey = await oidcKeyRegistry.getKey(issHash, newKeys[i].kid);
      expect(storedKey.kid).to.equal(newKeys[i].kid);
    }

    // Check that the other keys are still stored
    for (let i = 2; i < 8; i++) {
      const storedKey = await oidcKeyRegistry.getKey(issHash, keys[i].kid);
      expect(storedKey.kid).to.equal(keys[i].kid);
    }
  });

  it("delete leaves intuitive order 1", async () => {
    const iss = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(iss);

    // Fill the buffer
    const keys = Array.from({ length: 8 }, (_, i) => ({
      issHash,
      kid: pad(numberToHex(i + 1)),
      rsaModulus: JWK_MODULUS,
    }));
    await oidcKeyRegistry.addKeys(keys);
    // Add 4 more
    const moreKeys = Array.from({ length: 4 }, (_, i) => ({
      issHash,
      kid: pad(numberToHex(i + 9)),
      rsaModulus: JWK_MODULUS,
    }));
    await oidcKeyRegistry.addKeys(moreKeys);

    await oidcKeyRegistry.deleteKey(issHash, keys[6].kid);

    const allKeys = await oidcKeyRegistry.getKeys(issHash);

    expect(allKeys.map((key) => key.kid)).to.deep.equal(
      [
        keys[4].kid,
        keys[5].kid,
        keys[7].kid,
        moreKeys[0].kid,
        moreKeys[1].kid,
        moreKeys[2].kid,
        moreKeys[3].kid,
        pad("0x00"),
      ],
    );
  });

  it("uses first empty space after delete", async () => {
    const iss = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(iss);

    // Fill the buffer
    const keys = Array.from({ length: 5 }, (_, i) => ({
      issHash,
      kid: pad(numberToHex(i + 1)),
      rsaModulus: JWK_MODULUS,
    }));
    await oidcKeyRegistry.addKeys(keys);

    await oidcKeyRegistry.deleteKey(issHash, keys[2].kid);

    const extraKey = {
      issHash,
      kid: pad(numberToHex(100)),
      rsaModulus: JWK_MODULUS,
    };
    await oidcKeyRegistry.addKeys([extraKey]);

    const allKeys = await oidcKeyRegistry.getKeys(issHash);
    expect(allKeys.map((key) => key.kid)).to.deep.equal(
      [
        keys[0].kid,
        keys[1].kid,
        keys[3].kid,
        keys[4].kid,
        extraKey.kid,
        pad("0x00"),
        pad("0x00"),
        pad("0x00"),
      ],
    );
  });

  it("delete leaves intuitive order 2", async () => {
    const iss = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(iss);

    // Fill the buffer
    const keys = Array.from({ length: 8 }, (_, i) => ({
      issHash,
      kid: pad(numberToHex(i + 1)),
      rsaModulus: JWK_MODULUS,
      e: "0x010001",
    }));
    await oidcKeyRegistry.addKeys(keys);
    // Add 4 more
    const moreKeys = Array.from({ length: 4 }, (_, i) => ({
      issHash,
      kid: pad(numberToHex(i + 9)),
      rsaModulus: JWK_MODULUS,
      e: "0x010001",
    }));
    await oidcKeyRegistry.addKeys(moreKeys);

    await oidcKeyRegistry.deleteKey(issHash, moreKeys[2].kid);

    const allKeys = await oidcKeyRegistry.getKeys(issHash);

    expect(allKeys.map((key) => key.kid)).to.deep.equal(
      [
        keys[4].kid,
        keys[5].kid,
        keys[6].kid,
        keys[7].kid,
        moreKeys[0].kid,
        moreKeys[1].kid,
        moreKeys[3].kid,
        pad("0x00"),
      ],
    );
  });
});
