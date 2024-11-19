import { expect } from "chai";
import { parseEther } from "ethers";
import { Contract, Wallet } from "zksync-ethers";

import { deployContract, getWallet, LOCAL_RICH_WALLETS } from "../deploy/utils";

describe("ZeekNFTQuest", function () {
  let nftContract: Contract;
  let paymaster: Contract;
  let ownerWallet: Wallet;
  let recipientWallet: Wallet;
  const tokenURI = "http://localhost:3006/nft/metadata.json";

  before(async function () {
    ownerWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    recipientWallet = getWallet(LOCAL_RICH_WALLETS[1].privateKey);

    nftContract = await deployContract(
      "ZeekNFTQuest",
      [tokenURI],
      { wallet: ownerWallet, silent: true },
    );

    paymaster = await deployContract(
      "NFTQuestPaymaster",
      [await nftContract.getAddress()],
      { wallet: ownerWallet, silent: true });

    const tx = await ownerWallet.sendTransaction({
      to: await paymaster.getAddress(),
      value: parseEther("0.042"),
    });
    await tx.wait();
  });

  it("mints a new NFT to the recipient", async function () {
    const tx = await nftContract.mint(recipientWallet.address);
    await tx.wait();
    const nftTotal = await nftContract.balanceOf(recipientWallet.address);
    expect(nftTotal).to.equal(BigInt("1"));
  });

  // it("allows the paymaster to pay for the minting", async function () {
  //   const provider = await getProvider();
  //   const paymasterBalance = await provider.getBalance(await paymaster.getAddress());
  //   const walletBalance = await recipientWallet.getBalance();

  //   console.log("BALANCE", paymasterBalance.toString(), walletBalance.toString());

  //   // generate the paymaster signature for the minting
  //   const params = await usePaymaster(nftContract, await paymaster.getAddress());

  //   const tx = await nftContract.mint(recipientWallet.address);
  //   await tx.wait();
  //   const nftTotal = await nftContract.balanceOf(recipientWallet.address);
  //   expect(nftTotal).to.equal(BigInt("2"));
  // });

  it("has correct token URI after minting", async function () {
    const tokenURI = await nftContract.tokenURI();
    expect(tokenURI).to.equal("http://localhost:3006/nft/metadata.json");
  });

  // it("allows anyone to mint multiple NFTs", async function () {
  //   const tx1 = await nftContract.mint(recipientWallet.address);
  //   await tx1.wait();
  //   const tx2 = await nftContract.mint(recipientWallet.address);
  //   await tx2.wait();
  //   const balance = await nftContract.balanceOf(recipientWallet.address);
  //   expect(balance).to.equal(BigInt("3")); // 1 initial nft + 2 minted
  // });
});
