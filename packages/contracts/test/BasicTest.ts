import { assert, expect } from "chai";
import { parseEther, randomBytes } from "ethers";
import { Wallet, ZeroAddress } from "ethers";
import { it } from "mocha";
import { SmartAccount, utils } from "zksync-ethers";

import { SsoAccount__factory } from "../typechain-types";
import { CallStruct } from "../typechain-types/src/batch/BatchCaller";
import { ContractFixtures, getProvider } from "./utils";

describe("Basic tests", function () {
  const fixtures = new ContractFixtures();
  const provider = getProvider();
  let proxyAccountAddress: string;

  async function aaTxTemplate() {
    return {
      type: 113,
      from: proxyAccountAddress,
      data: "0x",
      value: 0,
      chainId: (await provider.getNetwork()).chainId,
      nonce: await provider.getTransactionCount(proxyAccountAddress),
      gasPrice: await provider.getGasPrice(),
      customData: { gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT },
      gasLimit: 0n,
    };
  }

  it("should deploy implemention", async () => {
    const accountImplContract = await fixtures.getAccountImplContract();
    assert(accountImplContract != null, "No account impl deployed");
  });

  it("should deploy proxy account via factory", async () => {
    const aaFactoryContract = await fixtures.getAaFactory();
    assert(aaFactoryContract != null, "No AA Factory deployed");

    const deployTx = await aaFactoryContract.deployProxySsoAccount(
      randomBytes(32),
      "id",
      [],
      [],
      [fixtures.wallet.address],
    );
    const deployTxReceipt = await deployTx.wait();
    proxyAccountAddress = deployTxReceipt!.contractAddress!;

    expect(proxyAccountAddress, "the proxy account location via logs").to.not.equal(ZeroAddress, "be a valid address");

    const account = SsoAccount__factory.connect(proxyAccountAddress, provider);
    assert(await account.k1IsOwner(fixtures.wallet.address));
  });

  it("should execute a simple transfer of ETH", async () => {
    const fundTx = await fixtures.wallet.sendTransaction({ value: parseEther("0.2"), to: proxyAccountAddress });
    await fundTx.wait();

    const balanceBefore = await provider.getBalance(proxyAccountAddress);

    const smartAccount = new SmartAccount({
      address: proxyAccountAddress,
      secret: fixtures.wallet.privateKey,
    }, provider);

    const value = parseEther("0.01");
    const target = Wallet.createRandom().address;

    const aaTx = {
      ...await aaTxTemplate(),
      to: target,
      value,
    };
    aaTx.gasLimit = await provider.estimateGas(aaTx);

    const signedTransaction = await smartAccount.signTransaction(aaTx);
    assert(signedTransaction != null, "valid transaction to sign");

    const tx = await provider.broadcastTransaction(signedTransaction);
    const receipt = await tx.wait();
    const fee = receipt.gasUsed * aaTx.gasPrice;
    expect(await provider.getBalance(proxyAccountAddress)).to.equal(balanceBefore - value - fee, "invalid final balance");
    expect(await provider.getBalance(target)).to.equal(value, "invalid final balance");
  });

  it("should execute a multicall", async () => {
    const smartAccount = new SmartAccount({
      address: proxyAccountAddress,
      secret: fixtures.wallet.privateKey,
    }, provider);

    const balanceBefore = await provider.getBalance(proxyAccountAddress);
    const value = parseEther("0.01");

    const target1 = Wallet.createRandom().address;
    const target2 = Wallet.createRandom().address;
    const calls: CallStruct[] = [
      {
        target: target1,
        value,
        callData: "0x",
        allowFailure: false,
      },
      {
        target: target2,
        value,
        callData: "0x",
        allowFailure: false,
      },
    ];

    const account = SsoAccount__factory.connect(proxyAccountAddress, provider);

    const aaTx = {
      ...await aaTxTemplate(),
      to: await account.BATCH_CALLER(),
      data: account.interface.encodeFunctionData("batchCall", [calls]),
      // value: value * 2n,
    };
    aaTx.gasLimit = await provider.estimateGas(aaTx);

    const signedTransaction = await smartAccount.signTransaction(aaTx);
    assert(signedTransaction != null, "valid transaction to sign");

    const tx = await provider.broadcastTransaction(signedTransaction);
    const receipt = await tx.wait();
    const fee = receipt.gasUsed * aaTx.gasPrice;

    expect(await provider.getBalance(proxyAccountAddress)).to.equal(balanceBefore - value * 2n - fee, "invalid final account balance");
    expect(await provider.getBalance(target1)).to.equal(value, "invalid final target balance");
    expect(await provider.getBalance(target2)).to.equal(value, "invalid final target balance");
  });
});
