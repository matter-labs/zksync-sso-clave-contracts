import { ethers } from "ethers";
import { task } from "hardhat/config";

task("verify-paymaster-factory", "Verifies that a paymaster supports a specific factory")
  .addParam("paymaster", "address of the paymaster to check")
  .addParam("factory", "address of the factory to verify")
  .setAction(async (cmd, hre) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getProvider } = require("../test/utils");

    const provider = getProvider();

    console.log("🔍 Verifying paymaster factory support on network:", hre.network.name);
    console.log("💳 Paymaster address:", cmd.paymaster);
    console.log("🏭 Factory address:", cmd.factory);

    try {
      // Paymaster ABI to read stored addresses
      const paymasterAbi = [
        "function AA_FACTORY_CONTRACT_ADDRESS() view returns (address)",
        "function SESSION_KEY_VALIDATOR_CONTRACT_ADDRESS() view returns (address)",
        "function ACCOUNT_RECOVERY_VALIDATOR_CONTRACT_ADDRESS() view returns (address)",
        "function WEB_AUTH_VALIDATOR_CONTRACT_ADDRESS() view returns (address)",
        "function OIDC_RECOVERY_VALIDATOR_CONTRACT_ADDRESS() view returns (address)",
      ];

      // Factory ABI to read beacon info
      const factoryAbi = [
        "function beacon() view returns (address)",
        "function passKeyModule() view returns (address)",
        "function sessionKeyModule() view returns (address)",
      ];

      const paymaster = new ethers.Contract(cmd.paymaster, paymasterAbi, provider);
      const factory = new ethers.Contract(cmd.factory, factoryAbi, provider);

      console.log("\n📊 PAYMASTER CONFIGURATION:");

      // Read paymaster configuration
      const paymasterFactory = await paymaster.AA_FACTORY_CONTRACT_ADDRESS();
      const paymasterSession = await paymaster.SESSION_KEY_VALIDATOR_CONTRACT_ADDRESS();
      const paymasterRecovery = await paymaster.ACCOUNT_RECOVERY_VALIDATOR_CONTRACT_ADDRESS();
      const paymasterPasskey = await paymaster.WEB_AUTH_VALIDATOR_CONTRACT_ADDRESS();
      const paymasterOidcRecovery = await paymaster.OIDC_RECOVERY_VALIDATOR_CONTRACT_ADDRESS();

      console.log("   Factory:", paymasterFactory);
      console.log("   Session:", paymasterSession);
      console.log("   Recovery:", paymasterRecovery);
      console.log("   Passkey:", paymasterPasskey);
      console.log("   OIDC Recovery:", paymasterOidcRecovery);

      console.log("\n🏭 FACTORY CONFIGURATION:");

      // Read factory configuration
      const factoryBeacon = await factory.beacon();
      const factoryPasskey = await factory.passKeyModule();
      const factorySession = await factory.sessionKeyModule();

      console.log("   Beacon:", factoryBeacon);
      console.log("   Passkey:", factoryPasskey);
      console.log("   Session:", factorySession);

      console.log("\n✅ COMPATIBILITY CHECK:");

      // Check if paymaster supports this factory
      const factoryMatches = paymasterFactory.toLowerCase() === cmd.factory.toLowerCase();
      const passkeyMatches = paymasterPasskey.toLowerCase() === factoryPasskey.toLowerCase();
      const sessionMatches = paymasterSession.toLowerCase() === factorySession.toLowerCase();

      console.log("   Factory matches:", factoryMatches ? "✅ YES" : "❌ NO");
      console.log("   Passkey module matches:", passkeyMatches ? "✅ YES" : "❌ NO");
      console.log("   Session module matches:", sessionMatches ? "✅ YES" : "❌ NO");

      const fullyCompatible = factoryMatches && passkeyMatches && sessionMatches;

      if (fullyCompatible) {
        console.log("\n🎉 RESULT: Paymaster is FULLY COMPATIBLE with the factory!");
        console.log("   ✅ Accounts created by this factory can use this paymaster");
        console.log("   ✅ All module addresses match");
      } else {
        console.log("\n⚠️ RESULT: Paymaster has COMPATIBILITY ISSUES!");

        if (!factoryMatches) {
          console.log("   ❌ Factory address mismatch - paymaster will reject transactions from this factory");
          console.log("      Expected:", cmd.factory);
          console.log("      Paymaster accepts:", paymasterFactory);
        }

        if (!passkeyMatches) {
          console.log("   ⚠️ Passkey module mismatch - may cause validation issues");
          console.log("      Factory uses:", factoryPasskey);
          console.log("      Paymaster expects:", paymasterPasskey);
        }

        if (!sessionMatches) {
          console.log("   ⚠️ Session module mismatch - may cause validation issues");
          console.log("      Factory uses:", factorySession);
          console.log("      Paymaster expects:", paymasterSession);
        }
      }

      // Check paymaster balance
      const balance = await provider.getBalance(cmd.paymaster);
      console.log("\n💰 PAYMASTER STATUS:");
      console.log("   Balance:", ethers.formatEther(balance), "ETH");
      console.log("   Funded:", balance > 0n ? "✅ YES" : "❌ NO - needs funding");

      // Verify both contracts exist
      const paymasterCode = await provider.getCode(cmd.paymaster);
      const factoryCode = await provider.getCode(cmd.factory);

      console.log("\n🔍 CONTRACT VERIFICATION:");
      console.log("   Paymaster exists:", paymasterCode !== "0x" ? "✅ YES" : "❌ NO");
      console.log("   Factory exists:", factoryCode !== "0x" ? "✅ YES" : "❌ NO");
    } catch (error) {
      console.error("❌ Error during verification:", error);
      throw error;
    }
  });
