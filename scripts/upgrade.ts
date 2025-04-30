import { ethers } from "ethers";
import fs from "fs";
import { task } from "hardhat/config";
import { Wallet } from "zksync-ethers";

import { deployCmd, getArgs, getDeployer, GUARDIAN_RECOVERY_NAME } from "./deploy";

task("upgrade", "Upgrades ZKsync SSO contracts")
  .addParam("proxyfile", "location of the file with proxy contract addresses")
  .addOptionalParam("artifactname", "name of the artifact to upgrade to, if not upgrade all")
  .setAction(async (cmd, hre) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LOCAL_RICH_WALLETS, getProvider } = require("../test/utils");
    let privateKey: string;
    if (hre.network.name == "inMemoryNode" || hre.network.name == "dockerizedNode") {
      console.log("Using local rich wallet");
      privateKey = LOCAL_RICH_WALLETS[0].privateKey;
      cmd.fund = "1";
    } else {
      if (!process.env.WALLET_PRIVATE_KEY) throw "Wallet private key wasn't found in .env file!";
      privateKey = process.env.WALLET_PRIVATE_KEY;
    }

    const wallet = new Wallet(privateKey, getProvider());

    console.log("Deploying new implementation of", cmd.artifactName, "contract...");
    const deployedContracts = await deployCmd(
      await hre.artifacts.readArtifact(GUARDIAN_RECOVERY_NAME),
      getArgs(cmd),
      getDeployer(hre, cmd),
      cmd.artifactname,
      true,
      0,
      "");

    for (const [contractName, contractAddress] of Object.entries(deployedContracts)) {
      console.log(`New ${contractName} implementation deployed at ${contractAddress}`);
      if ("accountPaymaster" == contractName) {
        console.log("ExampleAuthServerPaymaster not a proxy");
        continue;
      }

      const proxyAddresses = JSON.parse(fs.readFileSync(cmd.proxyfile).toString());
      const proxyAddress = proxyAddresses[contractName];
      console.log("Upgrading proxy at", proxyAddress);
      const abi = ["function upgradeTo(address newImplementation)"];
      const proxy = new ethers.Contract(proxyAddress, abi, wallet);
      const tx = await proxy.upgradeTo(contractAddress);
      await tx.wait();
      console.log("Proxy upgraded successfully");
    }
  });
