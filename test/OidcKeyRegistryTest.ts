import { Address } from "viem";
import { ContractFixtures } from "./utils";
import { Wallet } from "zksync-ethers";
import { expect } from "chai";
import { OidcKeyRegistry, OidcKeyRegistry__factory } from "../typechain-types";

describe("OidcKeyRegistry", function () {
  const fixtures = new ContractFixtures();
  let oidcKeyRegistry: OidcKeyRegistry;

  this.beforeAll(async () => {
    const contract = await fixtures.getOidcKeyRegistryContract();
    let oidcKeyRegistryAddress = await contract.getAddress() as Address;
    let deployer: Wallet = fixtures.wallet;
    oidcKeyRegistry = OidcKeyRegistry__factory.connect(oidcKeyRegistryAddress, deployer);
  });

  it("should set one key", async () => {
    const oidcKeyRegistry = await fixtures.getOidcKeyRegistryContract();
  
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
});