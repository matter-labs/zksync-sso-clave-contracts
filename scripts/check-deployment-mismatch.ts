import { ethers } from "ethers";
import fs from "fs";
import { task } from "hardhat/config";

task("check-deployment-mismatch", "Checks for deployment mismatches between expected and actual beacon addresses")
  .addParam("proxyfile", "location of the file with proxy contract addresses")
  .addParam("expectedbeacon", "expected beacon address")
  .setAction(async (cmd, hre) => {
    console.log("🔍 Checking for deployment mismatches on network:", hre.network.name);
    console.log("Expected beacon address:", cmd.expectedbeacon);

    // Read the deployed contract addresses
    const proxyAddresses = JSON.parse(fs.readFileSync(cmd.proxyfile).toString());

    const factoryAddress = proxyAddresses.accountFactory;
    if (!factoryAddress) {
      throw new Error("No accountFactory address found in proxy file");
    }

    // Get provider
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getProvider } = require("../test/utils");
    const provider = getProvider();

    // Factory ABI to read the beacon address
    const factoryAbi = [
      "function beacon() view returns (address)",
    ];

    // Beacon ABI to read the implementation
    const beaconAbi = [
      "function implementation() view returns (address)",
      "function owner() view returns (address)",
    ];

    try {
      // Get actual beacon address from factory
      const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
      const actualBeaconAddress = await factory.beacon();

      console.log("\n📊 MISMATCH ANALYSIS:");
      console.log("🏭 Factory address:", factoryAddress);
      console.log("🎯 Expected beacon:", cmd.expectedbeacon);
      console.log("📡 Actual beacon:  ", actualBeaconAddress);
      console.log("❌ MISMATCH:", actualBeaconAddress.toLowerCase() !== cmd.expectedbeacon.toLowerCase() ? "YES" : "NO");

      // Check both beacons
      console.log("\n🔍 CHECKING BOTH BEACONS:");

      // Check expected beacon
      console.log("\n1️⃣ Expected Beacon:", cmd.expectedbeacon);
      try {
        const expectedBeacon = new ethers.Contract(cmd.expectedbeacon, beaconAbi, provider);
        const expectedImpl = await expectedBeacon.implementation();
        console.log("   ✅ Implementation:", expectedImpl);

        try {
          const expectedOwner = await expectedBeacon.owner();
          console.log("   👤 Owner:", expectedOwner);
        } catch {
          console.log("   👤 Owner: (not readable or no owner function)");
        }
      } catch (error) {
        console.log("   ❌ Error reading expected beacon:", error.message);
      }

      // Check actual beacon
      console.log("\n2️⃣ Actual Beacon:", actualBeaconAddress);
      try {
        const actualBeacon = new ethers.Contract(actualBeaconAddress, beaconAbi, provider);
        const actualImpl = await actualBeacon.implementation();
        console.log("   ✅ Implementation:", actualImpl);

        try {
          const actualOwner = await actualBeacon.owner();
          console.log("   👤 Owner:", actualOwner);
        } catch {
          console.log("   👤 Owner: (not readable or no owner function)");
        }
      } catch (error) {
        console.log("   ❌ Error reading actual beacon:", error.message);
      }

      // Check if there are any accounts using the old beacon
      console.log("\n🔍 IMPACT ANALYSIS:");
      if (actualBeaconAddress.toLowerCase() !== cmd.expectedbeacon.toLowerCase()) {
        console.log("⚠️  POTENTIAL ISSUES:");
        console.log("   • The factory is pointing to a different beacon than expected");
        console.log("   • New accounts will use beacon:", actualBeaconAddress);
        console.log("   • If old accounts exist, they might use beacon:", cmd.expectedbeacon);
        console.log("   • Upgrading only one beacon will not upgrade all accounts");
        console.log("\n💡 RECOMMENDATIONS:");
        console.log("   • Check if both beacons have accounts pointing to them");
        console.log("   • Upgrade both beacons to ensure all accounts are updated");
        console.log("   • Or migrate all accounts to use the same beacon");
      } else {
        console.log("✅ No mismatch detected - factory points to expected beacon");
      }

      // Try to get some bytecode to see if the contracts are identical
      console.log("\n🔍 BYTECODE COMPARISON:");
      try {
        const expectedBytecode = await provider.getCode(cmd.expectedbeacon);
        const actualBytecode = await provider.getCode(actualBeaconAddress);

        console.log("Expected beacon bytecode length:", expectedBytecode.length);
        console.log("Actual beacon bytecode length:", actualBytecode.length);
        console.log("Bytecode identical:", expectedBytecode === actualBytecode ? "✅ YES" : "❌ NO");
      } catch (error) {
        console.log("Error comparing bytecode:", error.message);
      }
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  });
