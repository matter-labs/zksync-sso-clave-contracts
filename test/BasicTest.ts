import { assert, expect } from "chai";
import { concat, ethers, keccak256, parseEther, randomBytes } from "ethers";
import { Wallet, ZeroAddress } from "ethers";
import { it } from "mocha";
import { SmartAccount, utils } from "zksync-ethers";
import { toBytes } from 'viem'
import hre from "hardhat";

import { SsoAccount__factory, Dummy__factory } from "../typechain-types";
import { CallStruct } from "../typechain-types/src/handlers/BatchCaller";
import { ContractFixtures, getProvider, create2, ethersStaticSalt } from "./utils";

import { createWalletClient, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { erc7739Actions } from 'viem/experimental'

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

    const factoryAddress = await aaFactoryContract.getAddress();
    expect(factoryAddress, "the factory address").to.equal(await fixtures.getAaFactoryAddress(), "factory address match");

    const bytecodeHash = await aaFactoryContract.beaconProxyBytecodeHash();
    const deployedAccountContract = await fixtures.getAccountProxyContract();
    const deployedAccountContractCode = await deployedAccountContract.getDeployedCode();
    assert(deployedAccountContractCode != null, "No account code deployed");
    const ssoBeaconBytecodeHash = ethers.hexlify(utils.hashBytecode(deployedAccountContractCode));
    expect(bytecodeHash, "deployed account bytecode hash").to.equal(ssoBeaconBytecodeHash, "deployed account code doesn't match");

    const args = await aaFactoryContract.getEncodedBeacon();
    const deployedBeaconAddress = new ethers.AbiCoder().encode(["address"], [await fixtures.getBeaconAddress()]);
    expect(args, "the beacon address").to.equal(deployedBeaconAddress, "the deployment beacon");

    const randomSalt = randomBytes(32);
    const uniqueSalt = keccak256(concat([randomSalt, toBytes(fixtures.wallet.address)]));
    const standardCreate2Address = utils.create2Address(factoryAddress, bytecodeHash, uniqueSalt, args);

    const preDeployAccountCode = await fixtures.wallet.provider.getCode(standardCreate2Address);
    expect(preDeployAccountCode, "expected deploy location").to.equal("0x", "nothing deployed here (yet)");

    const deployTx = await aaFactoryContract.deployProxySsoAccount(
      randomSalt,
      [],
      [fixtures.wallet.address],
    );
    const deployTxReceipt = await deployTx.wait();
    proxyAccountAddress = deployTxReceipt!.contractAddress!;

    const postDeployAccountCode = await fixtures.wallet.provider.getCode(standardCreate2Address);
    expect(postDeployAccountCode, "expected deploy location").to.not.equal("0x", "deployment didn't match create2!");

    expect(proxyAccountAddress, "the proxy account location via logs").to.not.equal(ZeroAddress, "be a valid address");
    expect(proxyAccountAddress, "the proxy account location").to.equal(standardCreate2Address, "be what create2 returns");

    const account = SsoAccount__factory.connect(proxyAccountAddress, provider);
    assert(await account.isK1Owner(fixtures.wallet.address));

    const emptyDeployTx = aaFactoryContract.deployProxySsoAccount(
      randomBytes(32),
      [],
      [],
    );

    await expect(emptyDeployTx).to.be.revertedWithCustomError(aaFactoryContract, "INVALID_ACCOUNT_KEYS");
  });

  it("should deploy modular account via factory", async () => {
    const aaFactoryContract = await fixtures.getAaFactory();
    assert(aaFactoryContract != null, "No AA Factory deployed");

    const factoryAddress = await aaFactoryContract.getAddress();
    expect(factoryAddress, "the factory address").to.equal(await fixtures.getAaFactoryAddress(), "factory address match");

    const bytecodeHash = await aaFactoryContract.beaconProxyBytecodeHash();
    const deployedAccountContract = await fixtures.getAccountProxyContract();
    const deployedAccountContractCode = await deployedAccountContract.getDeployedCode();
    assert(deployedAccountContractCode != null, "No account code deployed");
    const ssoBeaconBytecodeHash = ethers.hexlify(utils.hashBytecode(deployedAccountContractCode));
    expect(bytecodeHash, "deployed account bytecode hash").to.equal(ssoBeaconBytecodeHash, "deployed account code doesn't match");

    const args = await aaFactoryContract.getEncodedBeacon();
    const deployedBeaconAddress = new ethers.AbiCoder().encode(["address"], [await fixtures.getBeaconAddress()]);
    expect(args, "the beacon address").to.equal(deployedBeaconAddress, "the deployment beacon");

    const randomSalt = randomBytes(32);
    const uniqueSalt = keccak256(concat([randomSalt, toBytes(fixtures.wallet.address)]));
    const standardCreate2Address = utils.create2Address(factoryAddress, bytecodeHash, uniqueSalt, args);

    const preDeployAccountCode = await fixtures.wallet.provider.getCode(standardCreate2Address);
    expect(preDeployAccountCode, "expected deploy location").to.equal("0x", "nothing deployed here (yet)");

    const deployTx = await aaFactoryContract.deployModularAccount(
      randomSalt,
      "0x",
      "0x",
      [fixtures.wallet.address],
    );
    const deployTxReceipt = await deployTx.wait();
    proxyAccountAddress = deployTxReceipt!.contractAddress!;

    expect(proxyAccountAddress, "the proxy account location via logs").to.not.equal(ZeroAddress, "be a valid address");
    expect(proxyAccountAddress, "the proxy account location").to.equal(standardCreate2Address, "be what create2 returns");

    const postDeployAccountCode = await fixtures.wallet.provider.getCode(standardCreate2Address);
    expect(postDeployAccountCode, "expected deploy location").to.not.equal("0x", "deployment didn't match create2!");

    const account = SsoAccount__factory.connect(proxyAccountAddress, provider);
    assert(await account.isK1Owner(fixtures.wallet.address));

    const emptyDeployTx = aaFactoryContract.deployModularAccount(
      randomBytes(32),
      "0x",
      "0x",
      [],
    );
    await expect(emptyDeployTx).to.be.revertedWithCustomError(aaFactoryContract, "INVALID_ACCOUNT_KEYS");
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
      value
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
      to: proxyAccountAddress,
      data: account.interface.encodeFunctionData("batchCall", [calls]),
      value: value * 2n,
    };
    aaTx.gasLimit = await provider.estimateGas(aaTx);

    const signedTransaction = await smartAccount.signTransaction(aaTx);
    assert(signedTransaction != null, "valid transaction to sign");

    const tx = await provider.broadcastTransaction(signedTransaction);
    const receipt = await tx.wait();
    const fee = receipt.gasUsed * aaTx.gasPrice;

    expect(await provider.getBalance(proxyAccountAddress)).to.equal(balanceBefore - value * 2n - fee, "invalid final own balance");
    expect(await provider.getBalance(target1)).to.equal(value, "invalid final target-1 balance");
    expect(await provider.getBalance(target2)).to.equal(value, "invalid final target-2 balance");
  });

  it("should emit an event with revert data from multicall", async () => {
    const smartAccount = new SmartAccount({
      address: proxyAccountAddress,
      secret: fixtures.wallet.privateKey,
    }, provider);

    const balanceBefore = await provider.getBalance(proxyAccountAddress);
    const value = parseEther("0.01");

    const dummy = await create2("Dummy", fixtures.wallet, ethersStaticSalt);

    const target = Wallet.createRandom().address;
    const calls: CallStruct[] = [
      {
        target: await dummy.getAddress(),
        value: 0,
        callData: Dummy__factory.createInterface().encodeFunctionData("justRevert"),
        allowFailure: true,
      },
      {
        target: target,
        value,
        callData: "0x",
        allowFailure: false,
      },
    ];

    const account = SsoAccount__factory.connect(proxyAccountAddress, provider);

    const aaTx = {
      ...await aaTxTemplate(),
      to: proxyAccountAddress,
      data: account.interface.encodeFunctionData("batchCall", [calls]),
      value,
      gasLimit: 300_000n,
    };

    const signedTransaction = await smartAccount.signTransaction(aaTx);
    assert(signedTransaction != null, "valid transaction to sign");

    const tx = await provider.broadcastTransaction(signedTransaction);
    const receipt = await tx.wait();
    const fee = receipt.gasUsed * aaTx.gasPrice;

    expect(await provider.getBalance(proxyAccountAddress)).to.equal(balanceBefore - value - fee, "invalid final own balance");
    expect(await provider.getBalance(target)).to.equal(value, "invalid final target balance");

    const logs = receipt.logs.filter((log) => log.address === proxyAccountAddress);
    expect(logs).to.have.lengthOf(1, "should only have one log from the batch caller");
    const revertMessage = new ethers.AbiCoder().encode(["string"], ["Just reverted"]);
    logs.forEach((log) => {
      const event: any = account.interface.parseLog(log);
      expect(event?.name).to.equal("BatchCallFailure");
      expect(event?.args.index).to.equal(0);
      expect(event?.args.revertData).to.contain(revertMessage.slice(2));
    });
  });

  it("should verify signature with EIP1271 using ERC7739", async () => {
    const erc1271Caller = await fixtures.deployERC1271Caller();
    const testStruct: ERC1271Caller.TestStructStruct = {
      message: "test",
      value: 42
    };

    const _callerDomain = await erc1271Caller.eip712Domain();
    const callerDomain = {
        name: _callerDomain.name,
        version: _callerDomain.version,
        chainId: Number(_callerDomain.chainId),
        verifyingContract: _callerDomain.verifyingContract as Hex,
    } as const;

    const types = {
      TestStruct: [
        { name: "message", type: "string" },
        { name: "value", type: "uint256" }
      ]
    };

    const walletClient = createWalletClient({
      account: privateKeyToAccount(fixtures.wallet.privateKey as Hex),
      transport: http(hre.network.config["url"])
    }).extend(erc7739Actions());

    const signature = await walletClient.signTypedData({
      domain: callerDomain,
      types,
      primaryType: 'TestStruct',
      message: testStruct,
      verifier: proxyAccountAddress as Hex,
    });

    const isValid = await erc1271Caller.validateStruct(testStruct, proxyAccountAddress, signature);
    expect(isValid).to.be.true;
  });
});
