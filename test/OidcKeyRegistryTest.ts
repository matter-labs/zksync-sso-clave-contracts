import { expect } from "chai";
import { ethers } from "ethers";
import { Wallet } from "zksync-ethers";

import { OidcKeyRegistry, OidcKeyRegistry__factory } from "../typechain-types";
import { ContractFixtures, getProvider } from "./utils";

describe("OidcKeyRegistry", function () {
  let fixtures: ContractFixtures;
  let oidcKeyRegistry: OidcKeyRegistry;

  this.beforeEach(async () => {
    fixtures = new ContractFixtures();
    oidcKeyRegistry = await fixtures.deployOidcKeyRegistryContract();
  });

  it("should return empty key when fetching a non-existent key", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const nonExistentKid = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    await expect(oidcKeyRegistry.getKey(issHash, nonExistentKid)).to.be.revertedWith("Key not found");
  });

  it("should set one key", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const key = {
      kid: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      n: "0xabcdef",
      e: "0x010001",
    };

    await oidcKeyRegistry.setKey(issHash, key);

    const storedKey = await oidcKeyRegistry.getKey(issHash, key.kid);
    expect(storedKey.kid).to.equal(key.kid);
    expect(storedKey.n).to.equal(key.n);
    expect(storedKey.e).to.equal(key.e);
  });

  it("should revert when a non-owner tries to set a key", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const key = {
      kid: "0x3333333333333333333333333333333333333333333333333333333333333333",
      n: "0xcccc",
      e: "0x010001",
    };

    const nonOwner = Wallet.createRandom(getProvider());
    const nonOwnerRegistry = OidcKeyRegistry__factory.connect(await oidcKeyRegistry.getAddress(), nonOwner);

    await expect(nonOwnerRegistry.setKey(issHash, key)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should correctly implement circular key storage", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);

    const keys = Array.from({ length: 5 }, (_, i) => ({
      kid: ethers.keccak256(ethers.toUtf8Bytes(`key${i + 1}`)),
      n: "0xabcdef",
      e: "0x010001",
    }));

    for (const key of keys) {
      await oidcKeyRegistry.setKey(issHash, key);
    }

    // Check that the keys are stored correctly
    for (let i = 0; i < 5; i++) {
      const storedKey = await oidcKeyRegistry.getKey(issHash, keys[i].kid);
      expect(storedKey.kid).to.equal(keys[i].kid);
    }

    const moreKeys = Array.from({ length: 5 }, (_, i) => ({
      kid: ethers.keccak256(ethers.toUtf8Bytes(`key${i + 6}`)),
      n: "0xabcdef",
      e: "0x010001",
    }));

    for (const key of moreKeys) {
      await oidcKeyRegistry.setKey(issHash, key);
    }

    // Check that the new keys are stored correctly
    for (let i = 0; i < 5; i++) {
      const storedKey = await oidcKeyRegistry.getKey(issHash, moreKeys[i].kid);
      expect(storedKey.kid).to.equal(moreKeys[i].kid);
    }

    // Check that the old keys are not stored anymore
    for (let i = 0; i < 5; i++) {
      await expect(oidcKeyRegistry.getKey(issHash, keys[i].kid)).to.be.revertedWith("Key not found");
    }
  });
});
