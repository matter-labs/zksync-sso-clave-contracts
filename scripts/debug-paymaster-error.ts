import { ethers } from "ethers";
import { task } from "hardhat/config";

task("debug-paymaster-error", "Debug why paymaster is rejecting factory address")
  .addParam("factory", "factory address that's being rejected")
  .addParam("paymaster", "paymaster address being used")
  .addOptionalParam("oldpaymaster", "old paymaster address to compare")
  .setAction(async (cmd, hre) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getProvider } = require("../test/utils");

    const provider = getProvider();

    console.log("🐛 Debugging paymaster error on network:", hre.network.name);
    console.log("🏭 Factory address (being rejected):", cmd.factory);
    console.log("💳 Paymaster address (supposedly used):", cmd.paymaster);

    try {
      // Paymaster ABI to read configuration
      const paymasterAbi = [
        "function AA_FACTORY_CONTRACT_ADDRESS() view returns (address)",
        "function SESSION_KEY_VALIDATOR_CONTRACT_ADDRESS() view returns (address)",
        "function ACCOUNT_RECOVERY_VALIDATOR_CONTRACT_ADDRESS() view returns (address)",
        "function WEB_AUTH_VALIDATOR_CONTRACT_ADDRESS() view returns (address)",
        "function OIDC_RECOVERY_VALIDATOR_CONTRACT_ADDRESS() view returns (address)",
      ];

      console.log("\n🔍 CHECKING PAYMASTER CONFIGURATION:");

      const paymaster = new ethers.Contract(cmd.paymaster, paymasterAbi, provider);

      const supportedFactory = await paymaster.AA_FACTORY_CONTRACT_ADDRESS();
      const supportedSession = await paymaster.SESSION_KEY_VALIDATOR_CONTRACT_ADDRESS();
      const supportedRecovery = await paymaster.ACCOUNT_RECOVERY_VALIDATOR_CONTRACT_ADDRESS();
      const supportedPasskey = await paymaster.WEB_AUTH_VALIDATOR_CONTRACT_ADDRESS();
      const supportedOidcRecovery = await paymaster.OIDC_RECOVERY_VALIDATOR_CONTRACT_ADDRESS();

      console.log("📋 Paymaster accepts these addresses:");
      console.log("   Factory:", supportedFactory);
      console.log("   Session:", supportedSession);
      console.log("   Recovery:", supportedRecovery);
      console.log("   Passkey:", supportedPasskey);
      console.log("   OIDC Recovery:", supportedOidcRecovery);

      console.log("\n❓ MISMATCH ANALYSIS:");
      const factoryMatches = supportedFactory.toLowerCase() === cmd.factory.toLowerCase();
      console.log("   Factory matches:", factoryMatches ? "✅ YES" : "❌ NO");

      if (!factoryMatches) {
        console.log("   Expected:", cmd.factory);
        console.log("   Paymaster accepts:", supportedFactory);
        console.log("   🚨 THIS IS THE PROBLEM!");
      }

      // Check if we're accidentally using the old paymaster
      if (cmd.oldpaymaster) {
        console.log("\n🔍 CHECKING OLD PAYMASTER FOR COMPARISON:");
        try {
          const oldPaymaster = new ethers.Contract(cmd.oldpaymaster, paymasterAbi, provider);
          const oldSupportedFactory = await oldPaymaster.AA_FACTORY_CONTRACT_ADDRESS();
          console.log("   Old paymaster accepts factory:", oldSupportedFactory);

          const oldFactoryMatches = oldSupportedFactory.toLowerCase() === cmd.factory.toLowerCase();
          console.log("   Old paymaster would accept new factory:", oldFactoryMatches ? "✅ YES" : "❌ NO");
        } catch (error) {
          console.log("   ❌ Error reading old paymaster:", error.message);
        }
      }

      // Check contract existence
      console.log("\n🔍 CONTRACT EXISTENCE CHECK:");
      const paymasterCode = await provider.getCode(cmd.paymaster);
      const factoryCode = await provider.getCode(cmd.factory);

      console.log("   Paymaster exists:", paymasterCode !== "0x" ? "✅ YES" : "❌ NO");
      console.log("   Factory exists:", factoryCode !== "0x" ? "✅ YES" : "❌ NO");

      // Check paymaster balance
      const balance = await provider.getBalance(cmd.paymaster);
      console.log("   Paymaster balance:", ethers.formatEther(balance), "ETH");
      console.log("   Paymaster funded:", balance > 0n ? "✅ YES" : "❌ NO");

      console.log("\n💡 TROUBLESHOOTING SUGGESTIONS:");

      if (!factoryMatches) {
        console.log("🚨 ISSUE: Paymaster doesn't accept this factory address");
        console.log("   SOLUTIONS:");
        console.log("   1. Use the correct paymaster address that accepts this factory");
        console.log("   2. Update your frontend/backend to use the new paymaster address");
        console.log("   3. Deploy a new paymaster pointing to this factory");
        console.log("   4. Use the factory address that this paymaster accepts");
      }

      if (paymasterCode === "0x") {
        console.log("🚨 ISSUE: Paymaster contract doesn't exist");
        console.log("   SOLUTION: Verify the paymaster address is correct");
      }

      if (factoryCode === "0x") {
        console.log("🚨 ISSUE: Factory contract doesn't exist");
        console.log("   SOLUTION: Verify the factory address is correct");
      }

      if (balance === 0n) {
        console.log("🚨 ISSUE: Paymaster has no funds");
        console.log("   SOLUTION: Fund the paymaster with ETH");
      }

      console.log("\n📋 QUICK FIXES:");
      console.log("   • Correct paymaster for this factory:", cmd.paymaster);
      console.log("   • Factory this paymaster accepts:", supportedFactory);
      console.log("   • Make sure your transaction uses the right paymaster address");
    } catch (error) {
      console.error("❌ Error during debugging:", error);
      throw error;
    }
  });
