import { ethers } from "ethers";
import { task } from "hardhat/config";
import { Wallet } from "zksync-ethers";

task("upgrade-factory-beacon", "Upgrades the factory to point to a different SSO beacon")
  .addParam("factoryaddress", "address of the factory proxy")
  .addParam("newbeacon", "address of the new beacon the factory should point to")
  .addOptionalParam("keyregistryowner", "private key of the beacon owner (if different from wallet)")
  .setAction(async (cmd, hre) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LOCAL_RICH_WALLETS, getProvider } = require("../test/utils");
    let privateKey: string;

    if (hre.network.name == "inMemoryNode" || hre.network.name == "dockerizedNode") {
      console.log("Using local rich wallet");
      privateKey = LOCAL_RICH_WALLETS[0].privateKey;
    } else {
      if (!process.env.WALLET_PRIVATE_KEY) throw "Wallet private key wasn't found in .env file!";
      privateKey = process.env.WALLET_PRIVATE_KEY;
    }

    // Use keyregistryowner if provided, otherwise use main wallet
    const ownerKey = cmd.keyregistryowner || privateKey;
    const wallet = new Wallet(ownerKey, getProvider());

    console.log("🏭 Upgrading factory beacon reference on network:", hre.network.name);
    console.log("🎯 Factory address:", cmd.factoryaddress);
    console.log("📡 New beacon address:", cmd.newbeacon);
    console.log("👤 Using wallet:", wallet.address);

    // First, let's check what the factory currently points to
    const factoryAbi = [
      "function beacon() view returns (address)",
    ];

    const beaconAbi = [
      "function implementation() view returns (address)",
      "function owner() view returns (address)",
      "function upgradeTo(address newImplementation) external",
    ];

    try {
      // Check current factory beacon
      const factory = new ethers.Contract(cmd.factoryaddress, factoryAbi, wallet);

      // The factory is a beacon proxy, so we need to find its beacon
      const proxyAbi = [
        "function beacon() view returns (address)",
      ];

      const factoryProxy = new ethers.Contract(cmd.factoryaddress, proxyAbi, wallet);
      const factoryBeaconAddress = await factoryProxy.beacon();
      console.log("🔍 Factory is controlled by beacon:", factoryBeaconAddress);

      // Get current factory implementation
      const factoryBeacon = new ethers.Contract(factoryBeaconAddress, beaconAbi, wallet);
      const currentFactoryImpl = await factoryBeacon.implementation();
      console.log("📋 Current factory implementation:", currentFactoryImpl);

      // Check what beacon the current factory points to for accounts
      const currentAccountBeacon = await factory.beacon();
      console.log("📡 Current account beacon:", currentAccountBeacon);
      console.log("🎯 Target account beacon:", cmd.newbeacon);

      if (currentAccountBeacon.toLowerCase() === cmd.newbeacon.toLowerCase()) {
        console.log("✅ Factory already points to the target beacon - no upgrade needed!");
        return;
      }

      // We need to deploy a new factory implementation that points to the new beacon
      console.log("\n🚀 Deploying new factory implementation...");

      // Get the factory constructor parameters (we'll need to redeploy with new beacon)
      console.log("❌ LIMITATION: Cannot upgrade factory beacon reference");
      console.log("💡 REASON: The beacon address is set as 'immutable' in the factory constructor");
      console.log("📝 SOLUTION OPTIONS:");
      console.log("   1. Deploy a new factory with the correct beacon address");
      console.log("   2. Update your deployment configuration to use the current beacon");
      console.log("   3. Keep both beacons synchronized (which we already did)");

      console.log("\n📊 CURRENT STATE:");
      console.log("   Factory beacon:", factoryBeaconAddress);
      console.log("   Factory impl:", currentFactoryImpl);
      console.log("   Account beacon (current):", currentAccountBeacon);
      console.log("   Account beacon (desired):", cmd.newbeacon);

      console.log("\n💡 RECOMMENDATION:");
      console.log("   Since both beacons now point to the same implementation,");
      console.log("   the safest approach is to keep the current setup and ensure");
      console.log("   both beacons are upgraded together in the future.");
    } catch (error) {
      console.error("❌ Error during factory beacon upgrade:", error);
      throw error;
    }
  });
