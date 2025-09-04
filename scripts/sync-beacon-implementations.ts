import { ethers } from "ethers";
import { task } from "hardhat/config";
import { Wallet } from "zksync-ethers";

task("sync-beacon-implementations", "Upgrades one beacon to match another beacon's implementation")
  .addParam("sourcebeacon", "address of the beacon to copy implementation from")
  .addParam("targetbeacon", "address of the beacon to upgrade")
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
    const beaconOwnerKey = cmd.keyregistryowner || privateKey;
    const wallet = new Wallet(beaconOwnerKey, getProvider());

    console.log("🔄 Syncing beacon implementations on network:", hre.network.name);
    console.log("📡 Source beacon (copy from):", cmd.sourcebeacon);
    console.log("🎯 Target beacon (upgrade to):", cmd.targetbeacon);
    console.log("👤 Using wallet:", wallet.address);

    // Beacon ABI
    const beaconAbi = [
      "function implementation() view returns (address)",
      "function owner() view returns (address)",
      "function upgradeTo(address newImplementation) external",
    ];

    try {
      // Get implementation from source beacon
      const sourceBeacon = new ethers.Contract(cmd.sourcebeacon, beaconAbi, wallet);
      const sourceImplementation = await sourceBeacon.implementation();
      console.log("📋 Source implementation:", sourceImplementation);

      // Check target beacon current implementation
      const targetBeacon = new ethers.Contract(cmd.targetbeacon, beaconAbi, wallet);
      const targetImplementation = await targetBeacon.implementation();
      console.log("📋 Target current implementation:", targetImplementation);

      // Check if they're already the same
      if (sourceImplementation.toLowerCase() === targetImplementation.toLowerCase()) {
        console.log("✅ Beacons already point to the same implementation - no upgrade needed!");
        return;
      }

      // Check ownership
      const targetOwner = await targetBeacon.owner();
      console.log("👤 Target beacon owner:", targetOwner);

      if (targetOwner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.warn("⚠️ WARNING: Wallet address doesn't match beacon owner");
        console.warn("   Wallet:", wallet.address);
        console.warn("   Owner:", targetOwner);
        console.warn("   This transaction may fail due to permissions");
      }

      // Perform the upgrade
      console.log("\n🚀 Upgrading target beacon...");
      console.log("   From:", targetImplementation);
      console.log("   To:  ", sourceImplementation);

      const tx = await targetBeacon.upgradeTo(sourceImplementation);
      console.log("📝 Transaction hash:", tx.hash);

      console.log("⏳ Waiting for confirmation...");
      const receipt = await tx.wait();
      console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

      // Verify the upgrade
      const newImplementation = await targetBeacon.implementation();
      console.log("🔍 Verification - new implementation:", newImplementation);

      if (newImplementation.toLowerCase() === sourceImplementation.toLowerCase()) {
        console.log("🎉 SUCCESS: Beacon upgrade completed successfully!");
        console.log("\n📊 FINAL STATUS:");
        console.log("   Source beacon:", cmd.sourcebeacon, "→", sourceImplementation);
        console.log("   Target beacon:", cmd.targetbeacon, "→", newImplementation);
        console.log("   ✅ Both beacons now point to the same implementation");
      } else {
        console.log("❌ ERROR: Upgrade verification failed");
        console.log("   Expected:", sourceImplementation);
        console.log("   Actual:", newImplementation);
      }
    } catch (error) {
      console.error("❌ Error during beacon sync:", error);
      throw error;
    }
  });
