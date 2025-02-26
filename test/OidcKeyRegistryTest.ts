import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { ContractFixtures, getProvider } from "./utils";
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
    let keys = await Promise.all(Array.from({ length: 8 }, (_, i) => oidcKeyRegistry.OIDCKeys(i)));
    const currentIndex = await oidcKeyRegistry.keyIndex();
    const nextIndex = ((currentIndex + 1n) % 8n) as unknown as number;
  
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
  
    const key = {
      issHash,
      kid: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      n: "0xabcdef",
      e: "0x010001",
    };
  
    keys[nextIndex] = [key.issHash, key.kid, key.n, key.e];
  
    const tree = StandardMerkleTree.of(keys, ["bytes32", "bytes32", "bytes", "bytes"]);
    const root = tree.root;
  
    await oidcKeyRegistry.addKey(key);
  
    const storedKey = await oidcKeyRegistry.getKey(issHash, key.kid);
    expect(storedKey.kid).to.equal(key.kid);
    expect(storedKey.n).to.equal(key.n);
    expect(storedKey.e).to.equal(key.e);
    expect(await oidcKeyRegistry.merkleRoot()).to.equal(root);
  });

  it("should set multiple keys", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const newKeys = Array.from({ length: 8 }, (_, i) => ({
      issHash,
      kid: ethers.keccak256(ethers.toUtf8Bytes(`key${i + 1}`)),
      n: "0xabcdef",
      e: "0x010001",
    }));

    await oidcKeyRegistry.addKeys(newKeys);

    for (let i = 0; i < 8; i++) {
      const storedKey = await oidcKeyRegistry.getKey(issHash, newKeys[i].kid);
      expect(storedKey.kid).to.equal(newKeys[i].kid);
    }
    
    let anotherKeyRegistry = await fixtures.deployOidcKeyRegistryContract();
    for (let i = 0; i < 8; i++) {
      await anotherKeyRegistry.addKey(newKeys[i]);
    }

    expect(await oidcKeyRegistry.merkleRoot()).to.equal(await anotherKeyRegistry.merkleRoot());
  });

  it("should revert when a non-owner tries to set a key", async () => {
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
    const key = {
      issHash,
      kid: "0x3333333333333333333333333333333333333333333333333333333333333333",
      n: "0xcccc",
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
      n: "0xabcdef",
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
      n: "0xabcdef",
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

  it("should verify key with merkle proof", async () => {
    let keys = await Promise.all(Array.from({ length: 8 }, (_, i) => oidcKeyRegistry.OIDCKeys(i)));
    const currentIndex = await oidcKeyRegistry.keyIndex();
    const nextIndex = ((currentIndex + 1n) % 8n) as unknown as number;
  
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
  
    const key = {
      issHash,
      kid: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      n: "0xabcdef",
      e: "0x010001",
    };
  
    keys[nextIndex] = [key.issHash, key.kid, key.n, key.e];
  
    const tree = StandardMerkleTree.of(keys, ["bytes32", "bytes32", "bytes", "bytes"]);
  
    await oidcKeyRegistry.addKey(key);
    
    const proof = tree.getProof([key.issHash, key.kid, key.n, key.e]);
    
    const isValid = await oidcKeyRegistry.verifyKey(key, proof);
    expect(isValid).to.be.true;
  });

  it("verifyKey should return false when the key is not in the registry", async () => {
    let keys = await Promise.all(Array.from({ length: 8 }, (_, i) => oidcKeyRegistry.OIDCKeys(i)));
    const currentIndex = await oidcKeyRegistry.keyIndex();
    const nextIndex = ((currentIndex + 1n) % 8n) as unknown as number;
  
    const issuer = "https://example.com";
    const issHash = await oidcKeyRegistry.hashIssuer(issuer);
  
    const key = {
      issHash,
      kid: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      n: "0xabcdef",
      e: "0x010001",
    };

    const nonExistentKey = {
      issHash,
      kid: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      n: "0xabcdef",
      e: "0x010001",
    };
  
    keys[nextIndex] = [key.issHash, key.kid, key.n, key.e];
  
    const tree = StandardMerkleTree.of(keys, ["bytes32", "bytes32", "bytes", "bytes"]);
  
    await oidcKeyRegistry.addKey(key);
    
    const proof = tree.getProof([key.issHash, key.kid, key.n, key.e]);
    
    const isValid = await oidcKeyRegistry.verifyKey(nonExistentKey, proof);
    expect(isValid).to.be.false;
  });
});
