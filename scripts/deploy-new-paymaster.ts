import { ethers } from "ethers";
import fs from "fs";
import { task } from "hardhat/config";
import { Wallet } from "zksync-ethers";

task("deploy-new-paymaster", "Deploys a new paymaster pointing to the specified factory")
  .addParam("factory", "address of the factory the paymaster should accept")
  .addParam("proxyfile", "location of the file with proxy contract addresses to get module addresses")
  .addOptionalParam("fund", "amount of ETH to send to the paymaster", "0")
  .addOptionalParam("output", "file to save the new paymaster address")
  .setAction(async (cmd, hre) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LOCAL_RICH_WALLETS, getProvider, create2, ethersStaticSalt } = require("../test/utils");
    let privateKey: string;

    if (hre.network.name == "inMemoryNode" || hre.network.name == "dockerizedNode") {
      console.log("Using local rich wallet");
      privateKey = LOCAL_RICH_WALLETS[0].privateKey;
      cmd.fund = cmd.fund || "1";
    } else {
      if (!process.env.WALLET_PRIVATE_KEY) throw "Wallet private key wasn't found in .env file!";
      privateKey = process.env.WALLET_PRIVATE_KEY;
    }

    const wallet = new Wallet(privateKey, getProvider());

    console.log("💳 Deploying new paymaster on network:", hre.network.name);
    console.log("🏭 Target factory address:", cmd.factory);
    console.log("👤 Using wallet:", wallet.address);

    // Read the current proxy addresses to get module addresses
    const proxyAddresses = JSON.parse(fs.readFileSync(cmd.proxyfile).toString());
    console.log("📋 Current contracts:", proxyAddresses);

    const sessionModule = proxyAddresses.session;
    const recoveryModule = proxyAddresses.recovery;
    const passkeyModule = proxyAddresses.passkey;
    const oidcRecoveryModule = proxyAddresses.recoveryOidc;

    if (!sessionModule || !recoveryModule || !passkeyModule || !oidcRecoveryModule) {
      throw new Error("Missing required module addresses in proxy file");
    }

    console.log("🔧 Using modules:");
    console.log("   Factory:", cmd.factory);
    console.log("   Session:", sessionModule);
    console.log("   Recovery:", recoveryModule);
    console.log("   Passkey:", passkeyModule);
    console.log("   OIDC Recovery:", oidcRecoveryModule);

    try {
      // Verify all the addresses exist
      console.log("\n🔍 Verifying target addresses...");
      const provider = getProvider();

      const addresses = [
        { name: "Factory", address: cmd.factory },
        { name: "Session", address: sessionModule },
        { name: "Recovery", address: recoveryModule },
        { name: "Passkey", address: passkeyModule },
        { name: "OIDC Recovery", address: oidcRecoveryModule },
      ];

      for (const { name, address } of addresses) {
        const code = await provider.getCode(address);
        if (code === "0x") {
          throw new Error(`${name} contract not found at ${address}`);
        }
        console.log(`   ✅ ${name}: ${address}`);
      }

      // Deploy the new paymaster
      console.log("\n🚀 Deploying new paymaster...");
      console.log("Parameters:");
      console.log("   aaFactoryAddress:", cmd.factory);
      console.log("   sessionKeyValidatorAddress:", sessionModule);
      console.log("   accountRecoveryValidatorAddress:", recoveryModule);
      console.log("   webAuthValidatorAddress:", passkeyModule);
      console.log("   oidcRecoveryValidatorAddress:", oidcRecoveryModule);

      const paymasterContract = await create2(
        "ExampleAuthServerPaymaster",
        wallet,
        ethersStaticSalt,
        [
          cmd.factory,
          sessionModule,
          recoveryModule,
          passkeyModule,
          oidcRecoveryModule,
        ],
      );

      const paymasterAddress = await paymasterContract.getAddress();
      console.log("🎉 New paymaster deployed at:", paymasterAddress);

      // Verify the deployment
      console.log("\n🔍 Verifying deployment...");
      const paymasterAbi = [
        "function AA_FACTORY_CONTRACT_ADDRESS() view returns (address)",
        "function SESSION_KEY_VALIDATOR_CONTRACT_ADDRESS() view returns (address)",
        "function ACCOUNT_RECOVERY_VALIDATOR_CONTRACT_ADDRESS() view returns (address)",
        "function WEB_AUTH_VALIDATOR_CONTRACT_ADDRESS() view returns (address)",
        "function OIDC_RECOVERY_VALIDATOR_CONTRACT_ADDRESS() view returns (address)",
      ];

      const newPaymaster = new ethers.Contract(paymasterAddress, paymasterAbi, wallet);

      const verifyFactory = await newPaymaster.AA_FACTORY_CONTRACT_ADDRESS();
      const verifySession = await newPaymaster.SESSION_KEY_VALIDATOR_CONTRACT_ADDRESS();
      const verifyRecovery = await newPaymaster.ACCOUNT_RECOVERY_VALIDATOR_CONTRACT_ADDRESS();
      const verifyPasskey = await newPaymaster.WEB_AUTH_VALIDATOR_CONTRACT_ADDRESS();
      const verifyOidcRecovery = await newPaymaster.OIDC_RECOVERY_VALIDATOR_CONTRACT_ADDRESS();

      console.log("✅ Verification results:");
      console.log("   Factory:", verifyFactory);
      console.log("   Session:", verifySession);
      console.log("   Recovery:", verifyRecovery);
      console.log("   Passkey:", verifyPasskey);
      console.log("   OIDC Recovery:", verifyOidcRecovery);
      console.log("   Factory matches:", verifyFactory.toLowerCase() === cmd.factory.toLowerCase());

      // Fund the paymaster if requested
      if (cmd.fund && parseFloat(cmd.fund) > 0) {
        console.log("\n💰 Funding paymaster with", cmd.fund, "ETH...");
        const tx = await wallet.sendTransaction({
          to: paymasterAddress,
          value: ethers.parseEther(cmd.fund.toString()),
        });
        await tx.wait();
        console.log("✅ Paymaster funded");

        const balance = await provider.getBalance(paymasterAddress);
        console.log("   Balance:", ethers.formatEther(balance), "ETH");
      } else {
        console.log("\n💡 Note: Paymaster not funded. Use --fund <amount> to fund it.");
      }

      // Save to output file if specified
      if (cmd.output) {
        const outputData = {
          ...proxyAddresses,
          newAccountPaymaster: paymasterAddress,
          deploymentInfo: {
            timestamp: new Date().toISOString(),
            network: hre.network.name,
            factory: cmd.factory,
            sessionModule,
            recoveryModule,
            passkeyModule,
            oidcRecoveryModule,
            fundedAmount: cmd.fund,
          },
        };
        fs.writeFileSync(cmd.output, JSON.stringify(outputData, null, 2));
        console.log("💾 Results saved to:", cmd.output);
      }

      console.log("\n📊 SUMMARY:");
      console.log("   Old paymaster:", proxyAddresses.accountPaymaster);
      console.log("   New paymaster:", paymasterAddress);
      console.log("   Target factory:", cmd.factory);
      console.log("   Funded amount:", cmd.fund || "0", "ETH");
    } catch (error) {
      console.error("❌ Error during paymaster deployment:", error);
      throw error;
    }
  });
