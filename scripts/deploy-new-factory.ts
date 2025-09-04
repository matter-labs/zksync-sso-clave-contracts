import { ethers } from "ethers";
import fs from "fs";
import { task } from "hardhat/config";
import { Wallet } from "zksync-ethers";

task("deploy-new-factory", "Deploys a new factory pointing to the specified beacon")
  .addParam("beacon", "address of the beacon the factory should point to")
  .addParam("proxyfile", "location of the file with proxy contract addresses to get module addresses")
  .addOptionalParam("output", "file to save the new factory address")
  .setAction(async (cmd, hre) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LOCAL_RICH_WALLETS, getProvider, deployFactory, ethersStaticSalt } = require("../test/utils");
    let privateKey: string;

    if (hre.network.name == "inMemoryNode" || hre.network.name == "dockerizedNode") {
      console.log("Using local rich wallet");
      privateKey = LOCAL_RICH_WALLETS[0].privateKey;
    } else {
      if (!process.env.WALLET_PRIVATE_KEY) throw "Wallet private key wasn't found in .env file!";
      privateKey = process.env.WALLET_PRIVATE_KEY;
    }

    const wallet = new Wallet(privateKey, getProvider());

    console.log("🏭 Deploying new factory on network:", hre.network.name);
    console.log("📡 Target beacon address:", cmd.beacon);
    console.log("👤 Using wallet:", wallet.address);

    // Read the current proxy addresses to get module addresses
    const proxyAddresses = JSON.parse(fs.readFileSync(cmd.proxyfile).toString());
    console.log("📋 Current contracts:", proxyAddresses);

    const passkeyModule = proxyAddresses.passkey;
    const sessionModule = proxyAddresses.session;

    if (!passkeyModule || !sessionModule) {
      throw new Error("Missing passkey or session module addresses in proxy file");
    }

    console.log("🔧 Using modules:");
    console.log("   Passkey:", passkeyModule);
    console.log("   Session:", sessionModule);

    try {
      // First, let's verify the beacon exists and get its implementation
      const beaconAbi = [
        "function implementation() view returns (address)",
      ];

      const beacon = new ethers.Contract(cmd.beacon, beaconAbi, wallet);
      const beaconImpl = await beacon.implementation();
      console.log("✅ Beacon verification - Implementation:", beaconImpl);

      // Deploy the new factory
      console.log("\n🚀 Deploying new factory...");
      console.log("Parameters:");
      console.log("   beacon:", cmd.beacon);
      console.log("   passkeyModule:", passkeyModule);
      console.log("   sessionModule:", sessionModule);

      const factoryContract = await deployFactory(
        wallet,
        cmd.beacon,
        passkeyModule,
        sessionModule,
        ethersStaticSalt,
      );

      const factoryAddress = await factoryContract.getAddress();
      console.log("🎉 New factory deployed at:", factoryAddress);

      // Verify the deployment
      console.log("\n🔍 Verifying deployment...");
      const factoryAbi = [
        "function beacon() view returns (address)",
        "function passKeyModule() view returns (address)",
        "function sessionKeyModule() view returns (address)",
      ];
      const newFactory = new ethers.Contract(factoryAddress, factoryAbi, wallet);
      const verifyBeacon = await newFactory.beacon();
      const verifyPasskey = await newFactory.passKeyModule();
      const verifySession = await newFactory.sessionKeyModule();

      console.log("✅ Verification results:");
      console.log("   Beacon:", verifyBeacon);
      console.log("   Passkey Module:", verifyPasskey);
      console.log("   Session Module:", verifySession);
      console.log("   Matches expected:", verifyBeacon.toLowerCase() === cmd.beacon.toLowerCase());

      // Save to output file if specified
      if (cmd.output) {
        const outputData = {
          ...proxyAddresses,
          newAccountFactory: factoryAddress,
          deploymentInfo: {
            timestamp: new Date().toISOString(),
            network: hre.network.name,
            beacon: cmd.beacon,
            passkeyModule,
            sessionModule,
          },
        };
        fs.writeFileSync(cmd.output, JSON.stringify(outputData, null, 2));
        console.log("💾 Results saved to:", cmd.output);
      }

      console.log("\n📊 SUMMARY:");
      console.log("   Old factory:", proxyAddresses.accountFactory);
      console.log("   New factory:", factoryAddress);
      console.log("   Target beacon:", cmd.beacon);
      console.log("   Implementation:", beaconImpl);
    } catch (error) {
      console.error("❌ Error during factory deployment:", error);
      throw error;
    }
  });
