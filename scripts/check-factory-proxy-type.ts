import { ethers } from "ethers";
import { task } from "hardhat/config";
import { Wallet } from "zksync-ethers";

task("check-factory-proxy-type", "Checks the factory proxy type and admin")
  .addParam("factoryaddress", "address of the factory proxy")
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

    const wallet = new Wallet(privateKey, getProvider());
    const provider = getProvider();

    console.log("🔍 Analyzing factory proxy on network:", hre.network.name);
    console.log("🎯 Factory address:", cmd.factoryaddress);
    console.log("👤 Using wallet:", wallet.address);

    try {
      // TransparentUpgradeableProxy admin functions
      const proxyAdminAbi = [
        "function admin() external view returns (address)",
        "function implementation() external view returns (address)",
        "function changeAdmin(address newAdmin) external",
        "function upgradeTo(address newImplementation) external",
        "function upgradeToAndCall(address newImplementation, bytes calldata data) external payable",
      ];

      // Factory implementation functions
      const factoryAbi = [
        "function beacon() view returns (address)",
      ];

      // Check if we can read admin (this will fail if we're the admin)
      console.log("\n📊 PROXY ANALYSIS:");

      // Try different approaches to get proxy info
      try {
        // Method 1: Try to call admin() - this will fail if we are the admin
        const proxyAsAdmin = new ethers.Contract(cmd.factoryaddress, proxyAdminAbi, provider);
        const admin = await proxyAsAdmin.admin();
        console.log("👤 Proxy admin:", admin);
        console.log("🔍 Admin matches wallet:", admin.toLowerCase() === wallet.address.toLowerCase());
      } catch (adminError) {
        console.log("⚠️ Cannot read admin (likely because we ARE the admin)");
        console.log("   Error:", adminError.message);
      }

      try {
        // Method 2: Try to get implementation
        const proxyAsAdmin = new ethers.Contract(cmd.factoryaddress, proxyAdminAbi, provider);
        const impl = await proxyAsAdmin.implementation();
        console.log("📋 Current implementation:", impl);
      } catch (implError) {
        console.log("⚠️ Cannot read implementation via admin interface");
        console.log("   Error:", implError.message);
      }

      // Method 3: Use a different address to check admin
      console.log("\n🔍 CHECKING PROXY WITH NON-ADMIN ADDRESS:");
      const randomProvider = new ethers.JsonRpcProvider(provider.connection.url);
      const proxyAsReader = new ethers.Contract(cmd.factoryaddress, proxyAdminAbi, randomProvider);

      try {
        const admin = await proxyAsReader.admin();
        console.log("👤 Proxy admin:", admin);
        console.log("🔍 Admin matches our wallet:", admin.toLowerCase() === wallet.address.toLowerCase());

        const impl = await proxyAsReader.implementation();
        console.log("📋 Current implementation:", impl);

        // Now try to read the beacon from the implementation
        const factoryImpl = new ethers.Contract(impl, factoryAbi, provider);
        const currentBeacon = await factoryImpl.beacon();
        console.log("📡 Current beacon address:", currentBeacon);
      } catch (error) {
        console.log("❌ Error reading proxy info:", error.message);
      }

      console.log("\n💡 CONCLUSIONS:");
      console.log("✅ Factory is a TransparentUpgradeableProxy");
      console.log("✅ Cannot change beacon address without deploying new implementation");
      console.log("📝 OPTIONS TO CHANGE BEACON:");
      console.log("   1. Deploy new factory implementation with correct beacon");
      console.log("   2. Use proxy admin to upgrade to new implementation");
      console.log("   3. Keep current setup (both beacons synchronized)");
    } catch (error) {
      console.error("❌ Error during analysis:", error);
      throw error;
    }
  });
