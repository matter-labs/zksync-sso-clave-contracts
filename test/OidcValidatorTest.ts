import { expect } from "chai";
import { ethers } from "hardhat";
import { getWallet, LOCAL_RICH_WALLETS, logInfo } from "./utils";
import { OidcKeyRegistry, OidcValidator } from "../typechain-types";

describe("OidcValidator", function () {
  const wallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
  let oidcValidator: OidcValidator;

  beforeEach(async function () {
    const [deployer] = await ethers.getSigners();
    const OidcKeyRegistryFactory = await ethers.getContractFactory("OidcKeyRegistry", deployer);
    const oidcKeyRegistry = (await OidcKeyRegistryFactory.deploy()) as OidcKeyRegistry;
    await oidcKeyRegistry.deployed();
    logInfo(`OidcKeyRegistry deployed to: ${oidcKeyRegistry.address}`);

    const OidcValidatorFactory = await ethers.getContractFactory("OidcValidator", deployer);
    oidcValidator = (await OidcValidatorFactory.deploy(oidcKeyRegistry.address, oidcKeyRegistry.address)) as OidcValidator;
    logInfo(`OidcValidator deployed to:`);
    await oidcValidator.deployed();
  });

  it("Should add a validation key", async function () {
    const oidcData = {
      oidcDigest: ethers.utils.formatBytes32String("test_digest"),
      iss: ethers.utils.formatBytes32String("test_issuer"),
      aud: ethers.utils.formatBytes32String("test_audience"),
    };
  });
});