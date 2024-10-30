import { assert, expect } from "chai";
import { AbiCoder, BytesLike, Contract, ethers, parseEther, randomBytes, ZeroAddress } from "ethers";
import * as hre from "hardhat";
import { it } from "mocha";
import { Address, createWalletClient, getAddress, Hash, http, publicActions } from "viem";
import { generatePrivateKey, privateKeyToAccount, privateKeyToAddress } from "viem/accounts";
import { waitForTransactionReceipt } from "viem/actions";
import { zksyncInMemoryNode } from "viem/chains";
import { createZksyncSessionClient, deployAccount } from "zksync-account/client";
import { setSessionKey } from "zksync-account/client/actions";
import { encodePasskeyModuleParameters, encodeSessionSpendLimitParameters } from "zksync-account/utils";
import { SmartAccount, types, utils, Wallet } from "zksync-ethers";

import type { AAFactory, ERC7579Account, SessionPasskeySpendLimitModule, WebAuthValidator } from "../typechain-types";
import { createZksyncPasskeyClient } from "./sdk/PasskeyClient";
import { create2, deployFactory, getProvider, getWallet, LOCAL_RICH_WALLETS, logInfo, RecordedResponse } from "./utils";

// Token Config Interface definitions
interface SpendLimit {
  tokenAddress: Address;
  limit: bigint;
}

interface SessionKey {
  // the public address of the session
  sessionKey: Address;
  // block timestamp
  expiresAt: bigint;
  // if not de-duplicated, the last token address wins
  spendLimits: SpendLimit[];
}
export class ContractFixtures {
  // NOTE: CHANGING THE READONLY VALUES WILL REQUIRE UPDATING THE STATIC SIGNATURE
  readonly wallet: Wallet = getWallet("0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110");
  readonly viemSessionKeyWallet: Wallet = getWallet(LOCAL_RICH_WALLETS[2].privateKey);
  readonly ethersStaticSalt = new Uint8Array([
    205, 241, 161, 186, 101, 105, 79,
    248, 98, 64, 50, 124, 168, 204,
    200, 71, 214, 169, 195, 118, 199,
    62, 140, 111, 128, 47, 32, 21,
    177, 177, 174, 166,
  ]);

  readonly viemStaticSalt = new Uint8Array([
    0, 0, 0, 0, 0, 0, 0,
    248, 98, 64, 50, 124, 168, 204,
    200, 71, 214, 169, 195, 118, 199,
    62, 140, 111, 128, 47, 32, 21,
    177, 177, 174, 166,
  ]);

  readonly tokenForSpendLimit = "0xAe045DE5638162fa134807Cb558E15A3F5A7F853";

  private abiCoder = new AbiCoder();

  private _aaFactory: AAFactory;
  async getAaFactory() {
    if (!this._aaFactory) {
      this._aaFactory = await deployFactory("AAFactory", this.wallet);
    }
    return this._aaFactory;
  }

  private _sessionSpendLimitModule: SessionPasskeySpendLimitModule;
  async getSessionSpendLimitContract() {
    if (!this._sessionSpendLimitModule) {
      this._sessionSpendLimitModule = <any> await create2("SessionPasskeySpendLimitModule", this.wallet, this.ethersStaticSalt);
    }
    return this._sessionSpendLimitModule;
  }

  private _webauthnValidatorModule: WebAuthValidator;
  // does passkey validation via modular interface
  async getWebAuthnVerifierContract() {
    if (!this._webauthnValidatorModule) {
      this._webauthnValidatorModule = <any> await create2("WebAuthValidator", this.wallet, this.ethersStaticSalt);
    }
    return this._webauthnValidatorModule;
  }

  private _passkeyModuleAddress: Address;
  async getPasskeyModuleAddress() {
    if (!this._passkeyModuleAddress) {
      const passkeyModule = await this.getWebAuthnVerifierContract();
      this._passkeyModuleAddress = getAddress(await passkeyModule.getAddress());
    }
    return this._passkeyModuleAddress;
  }

  private _accountImplContract: ERC7579Account;
  // wraps the clave account
  async getAccountImplContract() {
    if (!this._accountImplContract) {
      this._accountImplContract = <any> await create2("ERC7579Account", this.wallet, this.ethersStaticSalt);
    }
    return this._accountImplContract;
  }

  private _accountImplAddress: Address;
  // deploys the base account for future proxy use
  async getAccountImplAddress() {
    if (!this._accountImplAddress) {
      const accountImpl = await this.getAccountImplContract();
      this._accountImplAddress = <Address> await accountImpl.getAddress();
    }
    return this._accountImplAddress;
  }

  private _proxyAccountContract: Contract;
  async getProxyAccountContract() {
    const claveAddress = await this.getAccountImplAddress();
    if (!this._proxyAccountContract) {
      this._proxyAccountContract = await create2("AccountProxy", this.wallet, this.ethersStaticSalt, [claveAddress]);
    }
    return this._proxyAccountContract;
  }

  // need to store values that works on equal for use in map to memoize results
  private _fundedProxyAccountAddress: Map<string, Address> = new Map();
  async getFundedProxyAccount(salt: Uint8Array, response: RecordedResponse, initialSessionKeyWallet: Wallet) {
    const uniqueAccountKey = salt.toString() + response.passkeyBytes.toString() + initialSessionKeyWallet.address;
    const cachedProxyAddress = this._fundedProxyAccountAddress.get(uniqueAccountKey);
    if (cachedProxyAddress) {
      return cachedProxyAddress;
    }
    const passkeyModule = await this.getWebAuthnVerifierContract();
    const passkeyModuleAddress = await passkeyModule.getAddress();
    const sessionModuleContract = await this.getSessionSpendLimitContract();
    const sessionModuleAddress = await sessionModuleContract.getAddress();
    const factory = await this.getAaFactory();
    const accountImpl = await this.getAccountImplAddress();
    const proxyFix = await this.getProxyAccountContract();
    assert(proxyFix != null, "should deploy proxy");

    const sessionModuleData = this.abiCoder.encode(
      ["address", "bytes"],
      [sessionModuleAddress, this.getEncodedSessionModuleData(initialSessionKeyWallet.address as Address)]);
    const passkeyModuleData = this.abiCoder.encode(
      ["address", "bytes"],
      [passkeyModuleAddress, this.getEncodedPasskeyModuleData(response)]);
    const proxyAccount = await factory.deployProxy7579Account(
      salt,
      accountImpl,
      uniqueAccountKey,
      [sessionModuleData, passkeyModuleData],
      [],
      [],
    );

    const proxyAccountReceipt = await proxyAccount.wait();
    const proxyAccountAddress = <Address>proxyAccountReceipt!.contractAddress!;
    assert.isDefined(proxyAccountAddress, "no address set");
    await (
      await this.wallet.sendTransaction({
        to: proxyAccountAddress,
        value: parseEther("0.002"),
      })
    ).wait();
    const accountBalance = await this.wallet.provider.getBalance(proxyAccountAddress);
    assert(accountBalance > BigInt(0), "account balance should be positive");

    this._fundedProxyAccountAddress.set(uniqueAccountKey, proxyAccountAddress);
    return getAddress(proxyAccountAddress);
  }

  async passkeySigner(_hash: BytesLike, secret: RecordedResponse) {
    const fatSignature = this.abiCoder.encode(["bytes", "bytes", "bytes32[2]"], [
      secret.authDataBuffer,
      secret.clientDataBuffer,
      [secret.rs.r, secret.rs.s],
    ]);

    // clave expects signature + validator address + validator hook data
    const fullFormattedSig = this.abiCoder.encode(["bytes", "address", "bytes[]"], [
      fatSignature,
      await this.getPasskeyModuleAddress(),
      [],
    ]);

    return fullFormattedSig;
  };

  async sessionKeySigner(hash: BytesLike, secret: ethers.SigningKey) {
    const sessionKeySignature = secret.sign(hash);
    const spendLimitModule = await this.getSessionSpendLimitContract();
    return this.abiCoder.encode(["bytes", "address", "bytes[]"], [
      sessionKeySignature.serialized,
      await spendLimitModule.getAddress(),
      [],
    ]);
  };

  getSessionSpendLimitModuleData(sessionPublicKey: Address): SessionKey {
    return {
      sessionKey: sessionPublicKey,
      expiresAt: BigInt(1000000),
      spendLimits: [{
        tokenAddress: this.tokenForSpendLimit,
        limit: BigInt(1000),
      }],
    };
  }

  getEncodedSessionModuleData(sessionPublicKey: Address) {
    const sessionKeyData = this.getSessionSpendLimitModuleData(sessionPublicKey);
    return encodeSessionSpendLimitParameters([{
      sessionKey: sessionKeyData.sessionKey,
      expiresAt: new Date(parseInt((sessionKeyData.expiresAt * BigInt(1000)).toString())).toISOString(),
      spendLimit: Object.fromEntries(sessionKeyData.spendLimits.map((limit) => [
        limit.tokenAddress as Address, limit.limit.toString() as Hash,
      ])),
    }]);
  }

  // passkey has the public key + origin domain
  getEncodedPasskeyModuleData(response: RecordedResponse) {
    return encodePasskeyModuleParameters({
      passkeyPublicKey: response.getXyPublicKeys(),
      expectedOrigin: response.expectedOrigin,
    });
  }
}

describe.skip("Spend limit validation", function () {
  const fixtures = new ContractFixtures();
  const ethersResponse = new RecordedResponse("test/signed-challenge.json");
  const viemResponse = new RecordedResponse("test/signed-viem-challenge.json");
  const abiCoder = new AbiCoder();
  const provider = getProvider();

  it("should deploy module", async () => {
    const sessionModuleContract = await fixtures.getSessionSpendLimitContract();
    assert(sessionModuleContract != null, "No session spend limit module deployed");
  });

  it("should deploy verifier", async () => {
    const validatorModule = await fixtures.getWebAuthnVerifierContract();
    assert(validatorModule != null, "No passkey verifier deployed");
  });

  it("should deploy implemention", async () => {
    const accountImplContract = await fixtures.getAccountImplContract();
    assert(accountImplContract != null, "No account impl deployed");
  });

  it("should deploy proxy directly", async () => {
    const proxyAccountContract = await fixtures.getProxyAccountContract();
    assert(proxyAccountContract != null, "No account proxy deployed");
  });

  // This test relies on static data that is not available in the repo
  describe.skip("using viem", () => {
    it("should deploy proxy account via factory, create a new session key with a passkey, then send funds with the initial session key", async () => {
      const passkeyModule = await fixtures.getWebAuthnVerifierContract();
      const sessionModule = await fixtures.getSessionSpendLimitContract();
      const factoryContract = await fixtures.getAaFactory();
      const factoryAddress = await factoryContract.getAddress() as Address;

      const sessionModuleAddress = await sessionModule.getAddress() as Address;
      const passkeyModuleAddress = await passkeyModule.getAddress() as Address;
      const accountImplementationAddress = await fixtures.getAccountImplAddress() as Address;

      // fix for .only deployment
      const proxyFix = await fixtures.getProxyAccountContract();
      assert(proxyFix != null, "should deploy proxy");

      const localClient = {
        ...zksyncInMemoryNode,
        rpcUrls: {
          default: {
            http: [hre.network.config["url"]], // Override if not using the default port
          },
        },
      };

      const richWallet = createWalletClient({
        account: privateKeyToAccount(fixtures.wallet.privateKey as Hash),
        chain: localClient,
        transport: http(),
      }).extend(publicActions);

      /* 1. Deploy smart account */
      const rawSessionKeyData = fixtures.getSessionSpendLimitModuleData(fixtures.viemSessionKeyWallet.address as Address);
      const sessionKeyData = {
        sessionPublicKey: rawSessionKeyData.sessionKey,
        expiresAt: new Date(parseInt((rawSessionKeyData.expiresAt * BigInt(1000)).toString())).toISOString(),
        spendLimit: Object.fromEntries(rawSessionKeyData.spendLimits.map((limit) => [
          limit.tokenAddress, limit.limit.toString(),
        ])),
      };

      const proxyAccountDeployment = await deployAccount(richWallet as any, {
        credentialPublicKey: viemResponse.passkeyBytes,
        expectedOrigin: viemResponse.expectedOrigin,
        uniqueAccountId: "viemSpendLimitAccount",
        salt: fixtures.viemStaticSalt,
        contracts: {
          accountFactory: factoryAddress,
          accountImplementation: accountImplementationAddress,
          passkey: passkeyModuleAddress,
          session: sessionModuleAddress,
        },
        initialSessions: [
          {
            sessionPublicKey: sessionKeyData.sessionPublicKey,
            expiresAt: sessionKeyData.expiresAt,
            spendLimit: sessionKeyData.spendLimit,
          },
        ],
      });
      const proxyAccountAddress = proxyAccountDeployment.address;
      assert.isDefined(proxyAccountAddress, "no address set");

      /* 1.1 Fund smart account with some ETH to pay for transaction fees */
      const fundAccountTransactionHash = await waitForTransactionReceipt(richWallet, {
        hash: await richWallet.sendTransaction({
          to: proxyAccountAddress,
          value: parseEther("0.05"),
        }),
      });
      assert.equal(fundAccountTransactionHash.status, "success", "should fund without errors");

      /* 2. Validate passkey signed transactions */
      const passkeyClient = createZksyncPasskeyClient({
        address: proxyAccountAddress as Address,
        chain: localClient,
        contracts: {
          passkey: passkeyModuleAddress,
          session: sessionModuleAddress,
          accountFactory: factoryAddress,
          accountImplementation: accountImplementationAddress,
        },
        signHash: async () => ({
          authenticatorData: viemResponse.authenticatorData,
          clientDataJSON: viemResponse.clientData,
          signature: viemResponse.b64SignedChallenge,
        }),
        transport: http(),
      });

      await setSessionKey(passkeyClient as any, {
        sessionKey: sessionKeyData.sessionPublicKey,
        expiresAt: sessionKeyData.expiresAt,
        spendLimit: sessionKeyData.spendLimit,
        contracts: passkeyClient.contracts,
      });

      /* 3. Verify session key signed transactions */
      const sessionKeyClient = createZksyncSessionClient({
        address: proxyAccountAddress,
        sessionKey: fixtures.viemSessionKeyWallet.privateKey as Hash,
        contracts: {
          session: sessionModuleAddress,
        },
        chain: localClient,
        transport: http(),
      });

      const sessionKeySignedTransactionHash = await sessionKeyClient.sendTransaction({
        to: privateKeyToAddress(generatePrivateKey()), // send any transaction to a random address
        value: 1n,
      });
      const sessionKeyReceipt = await waitForTransactionReceipt(sessionKeyClient as any, { hash: sessionKeySignedTransactionHash });
      assert.equal(sessionKeyReceipt.status, "success", "(sessionkey) transaction should be successful");
    });
  });

  describe("using ethers", () => {
    it("should deploy proxy account via factory", async () => {
      const aaFactoryContract = await fixtures.getAaFactory();
      assert(aaFactoryContract != null, "No AA Factory deployed");

      const spendLimitModule = await fixtures.getSessionSpendLimitContract();
      assert(spendLimitModule != null, "no module available");

      const passkeyModule = await fixtures.getWebAuthnVerifierContract();
      assert(passkeyModule != null, "no verifier available");

      const forceDeploy = await fixtures.getProxyAccountContract();
      assert(forceDeploy != null, "proxy fails");

      const sessionKeyWallet = Wallet.createRandom(getProvider());
      const webauthModuleData = abiCoder.encode(
        ["address", "bytes"],
        [await passkeyModule.getAddress(), fixtures.getEncodedPasskeyModuleData(ethersResponse)]);
      const sessionSpendModuleData = abiCoder.encode(
        ["address", "bytes"],
        [await spendLimitModule.getAddress(), fixtures.getEncodedSessionModuleData(sessionKeyWallet.address as Address)]);
      const proxyAccount = await aaFactoryContract.deployProxy7579Account(
        randomBytes(32),
        await fixtures.getAccountImplAddress(),
        "testProxyAccount",
        [webauthModuleData, sessionSpendModuleData],
        [],
        [],
      );
      const proxyAccountTxReceipt = await proxyAccount.wait();

      // Extract and decode the return address from the return data/logs
      // Assuming the return data is in the first log's data field
      //
      // Alternatively, we could emit an event like:
      //      event ProxyAccountDeployed(address accountAddress)
      //
      // Then, this would be more precise with decodeEventLog()
      const newAddress = abiCoder.decode(["address"], proxyAccountTxReceipt!.logs[0].data);
      const proxyAccountAddress = newAddress[0];

      expect(proxyAccountAddress, "the proxy account location via logs").to.not.equal(ZeroAddress, "be a valid address");
      expect(proxyAccountTxReceipt!.contractAddress, "the proxy account location via return").to.not.equal(ZeroAddress, "be a non-zero address");
    });

    it("should add passkey and verifier to account", async () => {
      //
      // PART ONE: Initialize ClaveAccount implemention, verifier module, spendlimit module, and factory
      //
      const aaFactoryContract = await fixtures.getAaFactory();
      assert(aaFactoryContract != null, "No AA Factory deployed");

      const validatorModule = await fixtures.getWebAuthnVerifierContract();
      const expensiveVerifierAddress = await validatorModule.getAddress();

      const sessionModuleAddress = await (await fixtures.getSessionSpendLimitContract()).getAddress();
      //
      // PART TWO: Install Module with passkey (salt needs to be random to not collide with other tests)
      //
      const sessionKeyWallet = Wallet.createRandom(getProvider());
      const passkeyModuleData = abiCoder.encode(
        ["address", "bytes"],
        [expensiveVerifierAddress, fixtures.getEncodedPasskeyModuleData(ethersResponse)]);
      const sessionModuleData = abiCoder.encode(
        ["address", "bytes"],
        [sessionModuleAddress, fixtures.getEncodedSessionModuleData(sessionKeyWallet.address as Address)]);
      const proxyAccount = await aaFactoryContract.deployProxy7579Account(
        randomBytes(32),
        await fixtures.getAccountImplAddress(),
        "passkeyVerifierAccount",
        [passkeyModuleData],
        [sessionModuleData],
        [],
      );
      const proxyAccountTxReceipt = await proxyAccount.wait();

      assert(proxyAccountTxReceipt!.contractAddress != ethers.ZeroAddress, "valid proxy account address");
    });

    // This test relies on static data that is not available in the repo
    it.skip("should add a new session key with a passkey", async () => {
      const initialSessionKeyWallet: Wallet = getWallet("0xf51513036f18ef46508ddb0fff7aa153260ff76721b2f53c33fc178152fb481e");
      const proxyAccountAddress = await fixtures.getFundedProxyAccount(
        fixtures.ethersStaticSalt,
        ethersResponse,
        initialSessionKeyWallet);

      const passkeySmartAccount = new SmartAccount({
        payloadSigner: fixtures.passkeySigner.bind(fixtures),
        address: proxyAccountAddress,
        secret: ethersResponse,
      }, getProvider());

      // we just need a stable wallet address, the fact that this is a rich wallet shouldn't matter
      const extraSessionKeyWallet: Wallet = getWallet(LOCAL_RICH_WALLETS[4].privateKey);
      const tokenData = fixtures.getSessionSpendLimitModuleData(extraSessionKeyWallet.address as Address);
      const sessionModuleContract = await fixtures.getSessionSpendLimitContract();
      const callData = sessionModuleContract.interface.encodeFunctionData("setSessionKeys", [[tokenData]]);
      const aaTx = {
        from: proxyAccountAddress,
        to: getAddress(await sessionModuleContract.getAddress()),
        data: callData,
        gasPrice: await provider.getGasPrice(),
        customData: {} as types.Eip712Meta,
        gasLimit: BigInt(0),
      };
      aaTx["gasLimit"] = await provider.estimateGas(aaTx);

      const passkeySignedTransaction = await passkeySmartAccount.signTransaction(aaTx);
      assert(passkeySignedTransaction != null, "valid passkey transaction to sign");

      const passkeyTransactionResponse = await provider.broadcastTransaction(passkeySignedTransaction);
      const passkeyTransactionRecipt = await passkeyTransactionResponse.wait();
      assert.equal(passkeyTransactionRecipt.status, 1, "failed passkey transaction");
    });

    // This test relies on static data that is not available in the repo
    it.skip("might be able to add a session key with passkey, then a session key", async () => {
      const ethersPasskeyResponse = new RecordedResponse("test/signed-ethers-passkey.json");
      const initialSessionKeyWallet = getWallet("0xae3f083edae2d6fb1dfeaa6952ea260596eb67f9f26f4e17ca7d6916479ff9fa");
      const salt = new Uint8Array([
        200, 241, 161, 186, 101, 105, 79,
        240, 98, 64, 50, 124, 168, 204,
        200, 71, 214, 169, 195, 118, 199,
        60, 140, 111, 128, 47, 32, 21,
        170, 177, 174, 166,
      ]);
      const proxyAccountAddress = await fixtures.getFundedProxyAccount(
        salt,
        ethersPasskeyResponse,
        initialSessionKeyWallet);

      const passkeySmartAccount = new SmartAccount({
        payloadSigner: fixtures.passkeySigner.bind(fixtures),
        address: proxyAccountAddress,
        secret: ethersPasskeyResponse,
      }, getProvider());

      // we just need a stable wallet address, the fact that this is a rich wallet shouldn't matter
      const extraSessionKeyWallet: Wallet = getWallet("0x97006fa3cfc8f133ae17d8f0c9a815a8224246b0c667bf08b7a122f5be858c34");
      const tokenData = fixtures.getSessionSpendLimitModuleData(extraSessionKeyWallet.address as Address);

      const sessionModuleContract = await fixtures.getSessionSpendLimitContract();
      const callData = sessionModuleContract.interface.encodeFunctionData("setSessionKeys", [[tokenData]]);
      const transactionForPasskey = {
        from: proxyAccountAddress,
        to: getAddress(await sessionModuleContract.getAddress()),
        data: callData,
        gasPrice: await provider.getGasPrice(),
        customData: {} as types.Eip712Meta,
        gasLimit: BigInt(0),
      };
      transactionForPasskey["gasLimit"] = await provider.estimateGas(transactionForPasskey);

      const passkeySignedTransaction = await passkeySmartAccount.signTransaction(transactionForPasskey);
      assert(passkeySignedTransaction != null, "valid passkey transaction to sign");

      const passkeyTransactionResponse = await provider.broadcastTransaction(passkeySignedTransaction);
      const passkeyTransactionRecipt = await passkeyTransactionResponse.wait();
      assert.equal(passkeyTransactionRecipt.status, 1, "failed passkey transaction");

      // now the part that fails for a different novel reason?
      const thirdSessionKeyWallet = Wallet.createRandom(getProvider());
      const secondExtraSessionKeyData = fixtures.getSessionSpendLimitModuleData(thirdSessionKeyWallet.address as Address);
      const thirdSessionKeyCallData = sessionModuleContract.interface.encodeFunctionData("setSessionKeys", [[secondExtraSessionKeyData]]);
      const sessionModuleAddress = await sessionModuleContract.getAddress();
      const transactionForSessionKey = {
        from: proxyAccountAddress,
        to: getAddress(sessionModuleAddress),
        data: thirdSessionKeyCallData,
        gasPrice: await provider.getGasPrice(),
        customData: {} as types.Eip712Meta,
        gasLimit: BigInt(0),
      };
      transactionForSessionKey["gasLimit"] = await provider.estimateGas(transactionForSessionKey);

      transactionForSessionKey["nonce"] = await provider.getTransactionCount(proxyAccountAddress);
      transactionForSessionKey["gasLimit"] = await provider.estimateGas(transactionForSessionKey);
      const sessionKeySmartAccount = new SmartAccount({
        payloadSigner: fixtures.sessionKeySigner.bind(fixtures),
        address: proxyAccountAddress,
        secret: initialSessionKeyWallet.signingKey,
      }, getProvider());

      const sessionKeySignedTransaction = await sessionKeySmartAccount.signTransaction(transactionForSessionKey);
      assert(sessionKeySignedTransaction != null, "valid session key transaction to sign");

      const sessionKeyTransactionResponse = await provider.broadcastTransaction(sessionKeySignedTransaction);
      const sessionKeyTransactionRecipt = await sessionKeyTransactionResponse.wait();
      assert.equal(sessionKeyTransactionRecipt.status, 1, "failed session key transaction");
    });

    // (this will break when we implement permissions)

    it("can currently add a session key with another session key", async () => {
      const sessionModuleContract = await fixtures.getSessionSpendLimitContract();
      const sessionModuleAddress = await sessionModuleContract.getAddress();
      const factory = await fixtures.getAaFactory();
      const accountImpl = await fixtures.getAccountImplAddress();
      const proxyFix = await fixtures.getProxyAccountContract();
      assert(proxyFix != null, "should deploy proxy");

      // specfially empty wallet to ensure that it doesn't pay like an EOA
      const initialSessionKeyWallet = Wallet.createRandom(getProvider());
      const sessionModuleData = abiCoder.encode(
        ["address", "bytes"],
        [sessionModuleAddress, fixtures.getEncodedSessionModuleData(initialSessionKeyWallet.address as Address)]);
      const salt = new Uint8Array([
        200, 241, 161, 186, 101, 105, 70,
        240, 98, 64, 50, 124, 168, 200,
        200, 71, 214, 169, 195, 118, 190,
        60, 140, 111, 128, 47, 32, 20,
        170, 177, 174, 160,
      ]);
      const proxyAccount = await factory.deployProxy7579Account(
        salt,
        accountImpl,
        "sessionKeyAddingAnotherSessionKey",
        [sessionModuleData],
        [],
        [],
      );

      const proxyAccountReceipt = await proxyAccount.wait();
      const proxyAccountAddress = proxyAccountReceipt!.contractAddress;
      assert.isDefined(proxyAccountAddress, "no address set");
      await (
        await fixtures.wallet.sendTransaction({
          to: proxyAccountAddress,
          value: parseEther("0.002"),
        })
      ).wait();

      const accountBalance = await provider.getBalance(proxyAccountAddress!);
      assert(accountBalance > BigInt(0), "account balance needs to be positive");

      const extraSessionKeyWallet = Wallet.createRandom(getProvider());
      const tokenData = fixtures.getSessionSpendLimitModuleData(extraSessionKeyWallet.address as Address);
      const callData = sessionModuleContract.interface.encodeFunctionData("setSessionKeys", [[tokenData]]);
      const aaTx = {
        from: proxyAccountAddress,
        to: sessionModuleAddress as Address,
        data: callData,
        gasPrice: await provider.getGasPrice(),
        customData: {} as types.Eip712Meta,
        gasLimit: BigInt(0),
      };
      aaTx["gasLimit"] = await provider.estimateGas(aaTx);

      aaTx["nonce"] = await provider.getTransactionCount(proxyAccountAddress!);
      aaTx["gasLimit"] = await provider.estimateGas(aaTx);
      const sessionKeySmartAccount = new SmartAccount({
        payloadSigner: fixtures.sessionKeySigner.bind(fixtures),
        address: proxyAccountAddress!,
        secret: initialSessionKeyWallet.signingKey,
      }, getProvider());

      const sessionKeySignedTransaction = await sessionKeySmartAccount.signTransaction(aaTx);
      assert(sessionKeySignedTransaction != null, "valid session key transaction to sign");

      const sessionKeyTransactionResponse = await provider.broadcastTransaction(sessionKeySignedTransaction);
      const sessionKeyTransactionRecipt = await sessionKeyTransactionResponse.wait();
      assert.equal(sessionKeyTransactionRecipt.status, 1, "failed session key transaction");
    });

    // This looks like it's is trying to use the session key's EOA to perform a transfer,
    // which isn't the point of having a smart account!
    // even if we do fund the EOA we get a validation error: 0xe7931438
    it.skip("should be able to use a session key to perform a transfer", async () => {
      const sessionKeyAccount = Wallet.createRandom();
      const proxyAccountAddress = await fixtures.getFundedProxyAccount(randomBytes(32), ethersResponse, getWallet(sessionKeyAccount.privateKey));
      const accountBalanceBefore = await getProvider().getBalance(proxyAccountAddress);
      assert(accountBalanceBefore > BigInt(0), "account balance needs to start positive");
      const sessionKeySmartAccount = new SmartAccount({
        payloadSigner: fixtures.sessionKeySigner.bind(fixtures),
        address: proxyAccountAddress,
        secret: sessionKeyAccount.signingKey,
      }, getProvider());

      // sending to a random burn address, just want to see the amount dedecuted
      const transferAmount = ethers.parseEther("0.01");
      const transferTx = await sessionKeySmartAccount.transfer({
        token: utils.ETH_ADDRESS,
        to: Wallet.createRandom().address,
        amount: transferAmount,
      });
      const sessionKeyTransferReceipt = await transferTx.wait();
      assert.equal(sessionKeyTransferReceipt.status, 1, "failed session key transfer");

      const accountBalanceAfter = await getProvider().getBalance(proxyAccountAddress);
      // minus gas as well
      assert(accountBalanceAfter <= (accountBalanceBefore - transferAmount), "account balance to go down after transfer");
    });

    // this complains about the bad private key, but this account doesn't have a k1 private key
    // it only has a passkey and other tests are setup for custom signing and this one isn't even trying
    // similar to the session key transfer, this might be trying to treat the secret like an EOA during
    // the transfer insted of using the custom signer
    it.skip("should be able to use a passkey to perform a transfer", async () => {
      const salt = new Uint8Array([
        200, 240, 161, 186, 101, 105, 70,
        240, 90, 64, 50, 124, 168, 200,
        200, 70, 214, 169, 195, 118, 190,
        60, 140, 111, 128, 47, 32, 20,
        170, 170, 174, 160,
      ]);
      const proxyAccountAddress = await fixtures.getFundedProxyAccount(
        salt,
        ethersResponse,
        getWallet("0x2073ec805e7eaeefacccff067834afa4d81ea817c5d73fd05f0a1bc470b49887"));
      const passKeySmartAccount = new SmartAccount({
        payloadSigner: fixtures.passkeySigner.bind(fixtures),
        address: proxyAccountAddress,
        secret: ethersResponse,
      }, getProvider());
      const transferTx = await passKeySmartAccount.transfer({
        token: utils.ETH_ADDRESS,
        to: Wallet.createRandom().address,
        amount: ethers.parseEther("0.01"),
      });
      const passKeyTransferReceipt = await transferTx.wait();
      assert.equal(passKeyTransferReceipt.status, 1, "failed pass key transfer");
    });
  });

  // NOTE: Use `pnpm run deploy` to only deploy the contracts to your environment
  it("should deploy all contracts", async () => {
    const verifierContract = await fixtures.getWebAuthnVerifierContract();
    const sessionModuleContract = await fixtures.getSessionSpendLimitContract();
    const proxyContract = await fixtures.getProxyAccountContract();
    const erc7579Contract = await fixtures.getAccountImplContract();
    const factoryContract = await fixtures.getAaFactory();

    logInfo(`Session Address                : ${await sessionModuleContract.getAddress()}`);
    logInfo(`Passkey Address                : ${await verifierContract.getAddress()}`);
    logInfo(`Account Factory Address        : ${await factoryContract.getAddress()}`);
    logInfo(`Account Implementation Address : ${await erc7579Contract.getAddress()}`);
    logInfo(`Proxy Account Address          : ${await proxyContract.getAddress()}`);
  });
});
