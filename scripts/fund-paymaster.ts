import { ethers } from "ethers";
import { task } from "hardhat/config";
import { Wallet } from "zksync-ethers";

task("fund-paymaster", "Sends ETH to a paymaster contract")
  .addParam("paymaster", "address of the paymaster to fund")
  .addParam("amount", "amount of ETH to send")
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

    console.log("💰 Funding paymaster on network:", hre.network.name);
    console.log("🎯 Paymaster address:", cmd.paymaster);
    console.log("💵 Amount:", cmd.amount, "ETH");
    console.log("👤 From wallet:", wallet.address);

    try {
      // Check current balance
      const currentBalance = await provider.getBalance(wallet.address);
      console.log("📊 Wallet balance:", ethers.formatEther(currentBalance), "ETH");

      const paymasterCurrentBalance = await provider.getBalance(cmd.paymaster);
      console.log("📊 Paymaster current balance:", ethers.formatEther(paymasterCurrentBalance), "ETH");

      // Check if we have enough funds
      const amountWei = ethers.parseEther(cmd.amount);
      if (currentBalance < amountWei) {
        throw new Error(`Insufficient funds. Need ${cmd.amount} ETH, have ${ethers.formatEther(currentBalance)} ETH`);
      }

      // Send the transaction
      console.log("\n🚀 Sending transaction...");
      const tx = await wallet.sendTransaction({
        to: cmd.paymaster,
        value: amountWei,
      });

      console.log("📝 Transaction hash:", tx.hash);
      console.log("⏳ Waiting for confirmation...");

      const receipt = await tx.wait();
      console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

      // Check new balances
      const newWalletBalance = await provider.getBalance(wallet.address);
      const newPaymasterBalance = await provider.getBalance(cmd.paymaster);

      console.log("\n📊 FINAL BALANCES:");
      console.log("   Wallet:", ethers.formatEther(newWalletBalance), "ETH");
      console.log("   Paymaster:", ethers.formatEther(newPaymasterBalance), "ETH");
      console.log("   Transferred:", ethers.formatEther(amountWei), "ETH");

      console.log("\n🎉 Paymaster funding completed successfully!");
    } catch (error) {
      console.error("❌ Error during transfer:", error);
      throw error;
    }
  });
