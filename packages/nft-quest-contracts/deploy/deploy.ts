import { formatEther, parseEther } from "ethers";
import fs from "fs";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import path from "path";

import { deployContract, getProvider, getWallet } from "./utils";

export default async function (hre: HardhatRuntimeEnvironment) {
  const provider = getProvider();

  const baseTokenURI = "https://nft.zksync.dev/nft/metadata.json";
  const nftContract = await deployContract("ZeekNFTQuest", [baseTokenURI]);

  const paymasterContract = await deployContract("NFTQuestPaymaster", [await nftContract.getAddress()]);

  console.log("NFT CONTRACT: ", await nftContract.getAddress());
  console.log("PAYMASTER CONTRACT: ", await paymasterContract.getAddress());

  if (hre.network.config.ethNetwork.includes("localhost")) {
    // Update the .env.local file with the contract addresses for NFT Quest app
    const envFilePath = path.join(__dirname, "../../nft-quest/.env.local");

    // Check if the .env.local file exists, if not, create it
    if (!fs.existsSync(envFilePath)) {
      fs.writeFileSync(envFilePath, "", { encoding: "utf8" });
      console.log(`.env.local file has been created at ${envFilePath}`);
    }
    const nftContractAddress = await nftContract.getAddress();
    const paymasterContractAddress = await paymasterContract.getAddress();

    const envContent = `NUXT_PUBLIC_CONTRACTS_NFT=${nftContractAddress}\nNUXT_PUBLIC_CONTRACTS_PAYMASTER=${paymasterContractAddress}\n`;

    fs.writeFileSync(envFilePath, envContent, { encoding: "utf8" });
    console.log(`.env.local file has been updated at ${envFilePath}`);
  }

  // fund the paymaster contract with enough ETH to pay for transactions
  const wallet = getWallet();
  await (
    await wallet.sendTransaction({
      to: paymasterContract.target,
      value: parseEther("1"),
    })
  ).wait();

  const paymasterBalance = await provider.getBalance(paymasterContract.target.toString());
  console.log(
    `\nPaymaster ETH balance is now ${formatEther(
      paymasterBalance.toString(),
    )}`,
  );
}
