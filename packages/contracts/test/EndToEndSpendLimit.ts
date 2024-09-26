
import { SmartAccount, types, utils, Wallet } from "zksync-ethers";
import { parseEther, randomBytes } from 'ethers';
import { AbiCoder, Contract, ethers, ZeroAddress } from "ethers";
import { it } from "mocha";
import { logInfo, getWallet, getProvider, create2, deployFactory, RecordedResponse, LOCAL_RICH_WALLETS } from "./utils";
import { assert, expect } from "chai";
import * as hre from "hardhat";

import { Address, Hash, http, encodeFunctionData, createWalletClient, toHex, publicActions, getAddress, Chain } from "viem";
import { zksyncInMemoryNode } from "viem/chains";
import { createZksyncPasskeyClient } from "./sdk/PasskeyClient";
import { base64UrlToUint8Array, unwrapEC2Signature } from "./sdk/utils/passkey";
import { sendTransaction, waitForTransactionReceipt, writeContract } from "viem/actions";
import { privateKeyToAccount } from "viem/accounts";
import { HttpNetworkConfig } from "hardhat/types/config";

export class ContractFixtures {
    // NOTE: CHANGING THE READONLY VALUES WILL REQUIRE UPDATING THE STATIC SIGNATURE
    readonly wallet: Wallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    // Below Private Key was randomly generated for testing purposes
    readonly sessionKeyWallet: Wallet = getWallet("0xf51513036f18ef46508ddb0fff7aa153260ff76721b2f53c33fc178152fb481e");
    readonly ethersStaticSalt = new Uint8Array([
        205, 241, 161, 186, 101, 105, 79,
        248, 98, 64, 50, 124, 168, 204,
        200, 71, 214, 169, 195, 118, 199,
        62, 140, 111, 128, 47, 32, 21,
        177, 177, 174, 166
    ]);
    readonly viemStaticSalt = new Uint8Array([
        0, 0, 0, 0, 0, 0, 0,
        248, 98, 64, 50, 124, 168, 204,
        200, 71, 214, 169, 195, 118, 199,
        62, 140, 111, 128, 47, 32, 21,
        177, 177, 174, 166
    ])
    readonly tokenForSpendLimit = "0xAe045DE5638162fa134807Cb558E15A3F5A7F853";

    private _aaFactory: Contract;
    async getAaFactory() {
        if (!this._aaFactory) {
            this._aaFactory = await deployFactory("AAFactory", this.wallet);
        }
        return this._aaFactory;
    }

    private _passkeyModuleContract: Contract;
    async getPasskeyModuleContract() {
        if (!this._passkeyModuleContract) {
            this._passkeyModuleContract = await create2("SessionPasskeySpendLimitModule", this.wallet, this.ethersStaticSalt);
        }
        return this._passkeyModuleContract
    }

    private _expensiveVerifierContract: Contract;
    async getExpensiveVerifierContract() {
        if (!this._expensiveVerifierContract) {
            this._expensiveVerifierContract = await create2("PasskeyValidator", this.wallet, this.ethersStaticSalt);
        }
        return this._expensiveVerifierContract
    }
    private _accountImplContract: Contract;
    async getAccountImplContract() {
        if (!this._accountImplContract) {
            this._accountImplContract = await create2("ERC7579Account", this.wallet, this.ethersStaticSalt);
        }
        return this._accountImplContract;
    }

    private _accountImplAddress: string;
    async getAccountImplAddress() {
        if (!this._accountImplAddress) {
            const accountImpl = await this.getAccountImplContract();
            this._accountImplAddress = await accountImpl.getAddress();
        }
        return this._accountImplAddress
    }

    private _proxyAccountContract: Contract;
    async getProxyAccountContract() {
        const claveAddress = await this.getAccountImplAddress();
        if (!this._proxyAccountContract) {
            this._proxyAccountContract = await create2("AccountProxy", this.wallet, this.ethersStaticSalt, [claveAddress]);
        }
        return this._proxyAccountContract;
    }
}

describe("Spend limit validation", function () {
    const fixtures = new ContractFixtures();
    const ethersResponse = new RecordedResponse("test/signed-challenge.json");
    const viemResponse = new RecordedResponse("test/signed-viem-challenge.json");
    const abiCoder = new AbiCoder();
    const provider = getProvider();

    // Token Config Interface definitions
    interface TokenConfig {
        token: string; // address
        publicKey: Buffer; // bytes
        limit: ethers.BigNumberish; // uint256
    }
    const tokenConfigTypes = [
        "address", // token
        "bytes",   // publicKey
        "uint256"  // limit
    ];

    async function getTokenConfig() {
        return {
            token: fixtures.tokenForSpendLimit,
            publicKey: await ethersResponse.getXyPublicKey(),
            limit: ethers.toBigInt(1000)
        }
    }

    async function getModuleData() {
        return abiCoder.encode(
            [`tuple(${tokenConfigTypes.join(",")})[]`], // Solidity equivalent: TokenConfig[]
            [[await getTokenConfig()].map(config => [
                config.token,
                config.publicKey,
                config.limit
            ])]
        );

    }

    it("should deploy module", async () => {
        const passkeyModuleContract = await fixtures.getPasskeyModuleContract();
        assert(passkeyModuleContract != null, "No module deployed");
    });

    it("should deploy verifier", async () => {
        const expensiveVerifierContract = await fixtures.getExpensiveVerifierContract();
        assert(expensiveVerifierContract != null, "No verifier deployed");
    });

    it("should deploy implemention", async () => {
        const accountImplContract = await fixtures.getAccountImplContract();
        assert(accountImplContract != null, "No account impl deployed");
    });

    it("should deploy proxy directly", async () => {
        const proxyAccountContract = await fixtures.getProxyAccountContract();
        assert(proxyAccountContract != null, "No account proxy deployed");
    });

    it("should deploy proxy account via factory", async () => {
        const aaFactoryContract = await fixtures.getAaFactory();
        assert(aaFactoryContract != null, "No AA Factory deployed");

        const passkeyModule = await fixtures.getPasskeyModuleContract();
        assert(passkeyModule != null, "no module available");

        const expensiveVerifierContract = await fixtures.getExpensiveVerifierContract();
        assert(expensiveVerifierContract != null, "no verifier available");

        const proxyAccount = await aaFactoryContract.deployProxy7579Account(
            randomBytes(32),
            await fixtures.getAccountImplAddress(),
            await ethersResponse.getXyPublicKey(),
            expensiveVerifierContract,
            await passkeyModule.getAddress(),
            await getModuleData()
        );
        const proxyAccountTxReceipt = await proxyAccount.wait();

        // Extract and decode the return address from the return data/logs
        // Assuming the return data is in the first log's data field
        //
        // Alternatively, we could emit an event like:
        //      event ProxyAccountDeployed(address accountAddress)
        //
        // Then, this would be more precise with decodeEventLog()
        const newAddress = abiCoder.decode(["address"], proxyAccountTxReceipt.logs[0].data);
        const proxyAccountAddress = newAddress[0];

        expect(proxyAccountAddress, "the proxy account location via logs").to.not.equal(ZeroAddress, "be a valid address");
        expect(proxyAccountTxReceipt.contractAddress, "the proxy account location via return").to.not.equal(ZeroAddress, "be a non-zero address");
    });

    it("should add passkey and verifier to account", async () => {
        //
        // PART ONE: Initialize ClaveAccount implemention, verifier module, spendlimit module, and factory
        //
        const aaFactoryContract = await fixtures.getAaFactory();
        assert(aaFactoryContract != null, "No AA Factory deployed");

        const verifierContract = await fixtures.getExpensiveVerifierContract();
        const expensiveVerifierAddress = await verifierContract.getAddress();

        const moduleAddress = await (await fixtures.getPasskeyModuleContract()).getAddress();
        //
        // PART TWO: Install Module with passkey (salt needs to be random to not collide with other tests)
        //
        const proxyAccount = await aaFactoryContract.deployProxy7579Account(
            randomBytes(32),
            await fixtures.getAccountImplAddress(),
            await ethersResponse.getXyPublicKey(),
            expensiveVerifierAddress,
            moduleAddress,
            await getModuleData()
        );
        const proxyAccountTxReceipt = await proxyAccount.wait();

        assert(proxyAccountTxReceipt.contractAddress != ethers.ZeroAddress, "valid proxy account address");
    });

    it("should set spend limit via module with ethers", async () => {
        const verifierContract = await fixtures.getExpensiveVerifierContract();
        const expensiveVerifierAddress = await verifierContract.getAddress();
        const moduleContract = await fixtures.getPasskeyModuleContract();
        const moduleAddress = await moduleContract.getAddress();
        const factory = await fixtures.getAaFactory();
        const accountImpl = await fixtures.getAccountImplAddress();

        const proxyAccount = await factory.deployProxy7579Account(
            fixtures.ethersStaticSalt,
            accountImpl,
            await ethersResponse.getXyPublicKey(),
            expensiveVerifierAddress,
            moduleAddress,
            await getModuleData()
        );

        const proxyAccountReceipt = await proxyAccount.wait();
        const proxyAccountAddress = proxyAccountReceipt.contractAddress;
        assert.isDefined(proxyAccountAddress, "no address set");
        await (
            await fixtures.wallet.sendTransaction({
                to: proxyAccountAddress,
                value: parseEther('0.002'),
            })
        ).wait();

        const authDataBuffer = base64UrlToUint8Array(ethersResponse.authenticatorData);
        const clientDataBuffer = base64UrlToUint8Array(ethersResponse.clientData);
        const rs = unwrapEC2Signature(base64UrlToUint8Array(ethersResponse.b64SignedChallenge));
        // steps to get the data for this test
        // 1. build the transaction here in the test (aaTx)
        // 2. use this sample signer to get the transaction hash of a realistic transaction
        // 3. take that transaction hash to another app, and sign it (as the challange)
        // 4. bring that signed hash back here and have it returned as the signer
        const isTestMode = false;
        const extractSigningHash = (hash: string, secretKey, provider) => {
            const b64Hash = ethers.encodeBase64(hash)
            if (isTestMode) {
                return Promise.resolve<string>(b64Hash);
            } else {
                // the validator is now responsible for checking and hashing this
                const fatSignature = abiCoder.encode(["bytes", "bytes", "bytes32[2]"], [
                    authDataBuffer,
                    clientDataBuffer,
                    [rs.r, rs.s]
                ])

                // clave expects sigature + validator address + validator hook data
                const fullFormattedSig = abiCoder.encode(["bytes", "address", "bytes[]"], [
                    fatSignature,
                    expensiveVerifierAddress,
                    []
                ]);

                return Promise.resolve<string>(fullFormattedSig);
            }
        };

        // smart account secret isn't stored in javascript (because it's a passkey)
        // but we do have sessionkey secret
        const ethersTestSmartAccount = new SmartAccount({
            payloadSigner: extractSigningHash,
            address: proxyAccountAddress,
            secret: fixtures.sessionKeyWallet.privateKey
        }, getProvider());

        const tokenConfig = await getTokenConfig()
        const callData = moduleContract.interface.encodeFunctionData(
            'addSessionKey',
            [
                fixtures.sessionKeyWallet.address,
                tokenConfig.token,
                100,
            ]
        );
        const aaTx = {
            type: 113,
            from: proxyAccountAddress,
            to: moduleAddress as Address,
            data: callData,
            chainId: (await provider.getNetwork()).chainId,
            nonce: await provider.getTransactionCount(proxyAccountAddress),
            gasPrice: await provider.getGasPrice(),
            customData: {
                gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
            } as types.Eip712Meta,
        };

        aaTx['gasLimit'] = await provider.estimateGas(aaTx);

        const signedTransaction = await ethersTestSmartAccount.signTransaction(aaTx);
        assert(signedTransaction != null, "valid transaction to sign");

        await provider.broadcastTransaction(signedTransaction);
    });

    it("should set spend limit via module with viem", async () => {
        const verifierContract = await fixtures.getExpensiveVerifierContract();
        const moduleContract = await fixtures.getPasskeyModuleContract();
        const factoryContract = await fixtures.getAaFactory();

        const expensiveVerifierAddress = await verifierContract.getAddress();
        const moduleAddress = await moduleContract.getAddress();
        const accountImpl = await fixtures.getAccountImplAddress();
        const localClient: Chain = {
            ...zksyncInMemoryNode,
            rpcUrls: {
                default: {
                  // @ts-ignore 
                    http: [hre.network.config.url], // Override if not using the default port
                }
            }
        };

        const richWallet = createWalletClient({
            account: privateKeyToAccount(fixtures.wallet.privateKey as Hash),
            chain: localClient,
            transport: http(),
        }).extend(publicActions);

        const proxyAccount = await writeContract(richWallet as any, {
            address: await factoryContract.getAddress(),
            abi: [
            {
                "inputs": [
                    {
                    "internalType": "bytes32",
                    "name": "salt",
                    "type": "bytes32"
                    },
                    {
                    "internalType": "address",
                    "name": "accountImplementionLocation",
                    "type": "address"
                    },
                    {
                    "internalType": "bytes",
                    "name": "initialR1Owner",
                    "type": "bytes"
                    },
                    {
                    "internalType": "address",
                    "name": "initialR1Validator",
                    "type": "address"
                    },
                    {
                    "internalType": "address",
                    "name": "initialModule",
                    "type": "address"
                    },
                    {
                    "internalType": "bytes",
                    "name": "initData",
                    "type": "bytes"
                    }
                ],
                "name": "deployProxy7579Account",
                "outputs": [
                    {
                    "internalType": "address",
                    "name": "accountAddress",
                    "type": "address"
                    }
                ],
                "stateMutability": "nonpayable",
                "type": "function"
                }
            ] as const,
            functionName: "deployProxy7579Account",
            args: [
                toHex(fixtures.viemStaticSalt),
                accountImpl,
                toHex(await viemResponse.getXyPublicKey()),
                expensiveVerifierAddress,
                moduleAddress,
                await getModuleData()
            ],
        } as any);
        const proxyAccountReceipt = await waitForTransactionReceipt(richWallet as any, { hash: proxyAccount });
        const proxyAccountAddress = getAddress(proxyAccountReceipt.contractAddress!);

        assert.isDefined(proxyAccountAddress, "no address set");
        const chainResponse = await waitForTransactionReceipt(richWallet as any, {
            hash: await richWallet.sendTransaction({
                to: proxyAccountAddress,
                value: parseEther("0.05"),
            } as any)
        });
        assert.equal(chainResponse.status, "success", "should fund without errors");

        const passkeyClient = createZksyncPasskeyClient({
            address: proxyAccountAddress as Address,
            chain: localClient,
            key: "wallet",
            name: "ZKsync Account Passkey Client",
            signHash: async () => ({
                authenticatorData: viemResponse.authenticatorData,
                clientDataJSON: viemResponse.clientData,
                signature: viemResponse.b64SignedChallenge
            }),
            transport: http(),
            userDisplayName: "",
            userName: "",
        });

        const tokenConfig = await getTokenConfig();
        const callData = encodeFunctionData({
            abi: [
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "publicKey",
                    "type": "address"
                  },
                  {
                    "internalType": "address",
                    "name": "token",
                    "type": "address"
                  },
                  {
                    "internalType": "uint256",
                    "name": "expiration",
                    "type": "uint256"
                  }
                ],
                "name": "addSessionKey",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
              }
            ] as const,
            functionName: "addSessionKey",
            args: [
                fixtures.sessionKeyWallet.address as Address,
                tokenConfig.token as Address,
                BigInt(100)
            ],
        });

        const transactionHash = await sendTransaction(passkeyClient, {
            to: moduleAddress as Address,
            data: callData as Hash,
        } as any);

        const receipt = await waitForTransactionReceipt(passkeyClient, { hash: transactionHash });
        assert.equal(receipt.status, "success", "addSessionKey transaction should be successful");
    });

    // NOTE: If you just want to deploy contracts to your local node for testing,
    //       change 'it' to 'it.only' and only run this test.
    it("should deploy all contracts", async () => {
        const verifierContract = await fixtures.getExpensiveVerifierContract();
        const moduleContract = await fixtures.getPasskeyModuleContract();
        const proxyContract = await fixtures.getProxyAccountContract();
        const erc7579Contract = await fixtures.getAccountImplContract();
        const factoryContract = await fixtures.getAaFactory();

        logInfo(`Verifier Address      : ${await verifierContract.getAddress()}`);
        logInfo(`AA Factory Address    : ${await factoryContract.getAddress()}`);
        logInfo(`Proxy Account Address : ${await proxyContract.getAddress()}`);
        logInfo(`ERC7579 Address       : ${await erc7579Contract.getAddress()}`);
        logInfo(`Module Address        : ${await moduleContract.getAddress()}`);
    });
})
