// Copyright 2025 cbe
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { assert, expect } from "chai";
import { randomBytes } from "crypto";
import { parseEther, ZeroAddress } from "ethers";
import { SmartAccount, utils } from "zksync-ethers";

import { BaseHookExecution__factory, BaseHookValidator__factory, FailHookValidator, SsoAccount__factory, SuccessHookExecutor } from "../typechain-types";
import { ContractFixtures, create2, ethersStaticSalt, getProvider, getWallet, LOCAL_RICH_WALLETS, logInfo } from "./utils";

describe("Hook coverage", function () {
  const ownerWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
  const provider = getProvider();
  const ssoAbi = SsoAccount__factory.createInterface();
  const fixtures = new ContractFixtures();
  async function aaTxTemplate(accountAddress: string) {
    return {
      type: 113,
      from: accountAddress,
      data: "0x",
      value: 0,
      chainId: (await provider.getNetwork()).chainId,
      nonce: await provider.getTransactionCount(accountAddress),
      gasPrice: await provider.getGasPrice(),
      customData: {
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
      },
      gasLimit: 0n,
    };
  }
  async function testAaTx(from: string, data: string) {
    const smartAccount = new SmartAccount({
      address: from,
      secret: ownerWallet.privateKey,
    }, provider);

    const aaTx = {
      ...await aaTxTemplate(from),
      to: from,
      data,
    };
    aaTx.gasLimit = await provider.estimateGas(aaTx);

    const signedTransaction = await smartAccount.signTransaction(aaTx);
    const tx = await provider.broadcastTransaction(signedTransaction);
    const receipt = await tx.wait();
    logInfo(`transaction gas used: ${receipt.gasUsed.toString()}`);
  }

  async function getValidationHookContract(type: string): Promise<FailHookValidator> {
    const contract = await create2(`${type}HookValidator`, ownerWallet, ethersStaticSalt, []);
    return BaseHookValidator__factory.connect(await contract.getAddress(), ownerWallet);
  }

  async function getExecutionHookContract(type: string): Promise<SuccessHookExecutor> {
    const contract = await create2(`${type}HookExecutor`, ownerWallet, ethersStaticSalt, []);
    return BaseHookExecution__factory.connect(await contract.getAddress(), ownerWallet);
  }

  async function deployFundedAccount() {
    const factoryContract = await fixtures.getAaFactory();

    const randomSalt = randomBytes(32);
    const deployTx = await factoryContract.deployProxySsoAccount(
      randomSalt,
      "hook-test-id" + randomBytes(32).toString(),
      [],
      [ownerWallet.address],
    );

    const deployTxReceipt = await deployTx.wait();
    logInfo(`\`deployProxySsoAccount\` gas used: ${deployTxReceipt?.gasUsed.toString()}`);

    const proxyAccountAddress = deployTxReceipt!.contractAddress!;
    expect(proxyAccountAddress, "the proxy account location via logs").to.not.equal(ZeroAddress, "be a valid address");

    const fundTx = await ownerWallet.sendTransaction({ value: parseEther("1"), to: proxyAccountAddress });
    const receipt = await fundTx.wait();
    expect(receipt.status).to.eq(1, "send funds to proxy account");

    return { proxyAccountAddress };
  }

  describe("validation hook", function () {
    it("should support modules", async function () {
      const validationHookContract = await getValidationHookContract("Fail");
      const moduleInterface = await validationHookContract.supportsInterface("0xe7f04e93");
      const validationInterface = await validationHookContract.supportsInterface("0x37d5f03a");
      assert(moduleInterface, "supports module interface");
      assert(validationInterface, "supports hook interface");
    });

    it("should install into existing account", async function () {
      const { proxyAccountAddress } = await deployFundedAccount();
      const validationHookContract = await getValidationHookContract("Fail");
      const hookModuleAddress = await validationHookContract.getAddress();
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("addHook", [hookModuleAddress, "0x"]));
    });

    it("fail on duplicate install", async function () {
      const { proxyAccountAddress } = await deployFundedAccount();
      const validationHookContract = await getValidationHookContract("Success");
      const hookModuleAddress = await validationHookContract.getAddress();
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("addHook", [hookModuleAddress, "0x"]));

      await expect(testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("addHook", [hookModuleAddress, "0x"]))).to.be.reverted;
    });

    it("should uninstall from account", async function () {
      const { proxyAccountAddress } = await deployFundedAccount();
      const validationHookContract = await getValidationHookContract("Success");
      const hookModuleAddress = await validationHookContract.getAddress();
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("addHook", [hookModuleAddress, "0x"]));
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("removeHook", [hookModuleAddress, "0x"]));
    });

    it("not fail on duplicate remove", async function () {
      const { proxyAccountAddress } = await deployFundedAccount();
      const validationHookContract = await getValidationHookContract("Success");
      const hookModuleAddress = await validationHookContract.getAddress();
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("addHook", [hookModuleAddress, "0x"]));
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("removeHook", [hookModuleAddress, "0x"]));

      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("removeHook", [hookModuleAddress, "0x"]));
    });

    it("block transactions on failure", async function () {
      const { proxyAccountAddress } = await deployFundedAccount();
      const validationHookContract = await getValidationHookContract("Fail");
      const hookModuleAddress = await validationHookContract.getAddress();
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("addHook", [hookModuleAddress, "0x"]));
      await expect(testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("removeHook", [hookModuleAddress, "0x"]))).to.be.reverted;
    });
  });

  describe("execution hook", function () {
    it("should install into existing account", async function () {
      const { proxyAccountAddress } = await deployFundedAccount();
      const hookContract = await getExecutionHookContract("Success");
      const hookModuleAddress = await hookContract.getAddress();
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("addHook", [hookModuleAddress, "0x"]));
    });

    it("fail on duplicate install", async function () {
      const { proxyAccountAddress } = await deployFundedAccount();
      const hookContract = await getExecutionHookContract("Success");
      const hookModuleAddress = await hookContract.getAddress();
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("addHook", [hookModuleAddress, "0x"]));

      await expect(testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("addHook", [hookModuleAddress, "0x"]))).to.be.reverted;
    });

    it("should uninstall executor from account", async function () {
      const { proxyAccountAddress } = await deployFundedAccount();
      const hookContract = await getExecutionHookContract("Success");
      const hookModuleAddress = await hookContract.getAddress();
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("addHook", [hookModuleAddress, "0x"]));
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("removeHook", [hookModuleAddress, "0x"]));
    });

    it("not fail on duplicate remove", async function () {
      const { proxyAccountAddress } = await deployFundedAccount();
      const hookContract = await getExecutionHookContract("Success");
      const hookModuleAddress = await hookContract.getAddress();
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("addHook", [hookModuleAddress, "0x"]));
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("removeHook", [hookModuleAddress, "0x"]));

      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("removeHook", [hookModuleAddress, "0x"]));
    });

    it("block transactions on pre-execution failure", async function () {
      const { proxyAccountAddress } = await deployFundedAccount();
      const hookContract = await getExecutionHookContract("PreFail");
      const hookModuleAddress = await hookContract.getAddress();
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("addHook", [hookModuleAddress, "0x"]));
      await expect(testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("removeHook", [hookModuleAddress, "0x"]))).to.be.reverted;
    });

    it("block transactions on post-execution failure", async function () {
      const { proxyAccountAddress } = await deployFundedAccount();
      const hookContract = await getExecutionHookContract("PostFail");
      const hookModuleAddress = await hookContract.getAddress();
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("addHook", [hookModuleAddress, "0x"]));
      await expect(testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("removeHook", [hookModuleAddress, "0x"]))).to.be.reverted;
    });
  });

  describe("combined hook", function () {
    it("success on install & remove", async function () {
      const { proxyAccountAddress } = await deployFundedAccount();
      const contract = await create2(`SuccessBothHook`, ownerWallet, ethersStaticSalt, []);
      const hookModuleAddress = await contract.getAddress();
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("addHook", [hookModuleAddress, "0x"]));
      await testAaTx(proxyAccountAddress, ssoAbi.encodeFunctionData("removeHook", [hookModuleAddress, "0x"]));
    });
  });
});
