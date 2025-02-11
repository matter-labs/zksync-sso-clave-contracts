import { Address } from "viem";
import { ContractFixtures } from "./utils";
import { Wallet } from "zksync-ethers";
import { expect } from "chai";

describe("OidcKeyRegistry", function () {
  const fixtures = new ContractFixtures();
  let oidcKeyRegistryAddress: Address;
  let deployer: Wallet = fixtures.wallet;

  this.beforeAll(async () => {
    const oidcKeyRegistry = await fixtures.getOidcKeyRegistryContract();
    oidcKeyRegistryAddress = await oidcKeyRegistry.getAddress() as Address;
  });

  it("should deploy OidcKeyRegistry", async () => {
    expect(oidcKeyRegistryAddress).to.be.properAddress;
  });
});