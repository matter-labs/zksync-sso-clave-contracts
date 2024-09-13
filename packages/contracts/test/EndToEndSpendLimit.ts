
import { SmartAccount, types, utils } from "zksync-ethers";
import { deployFactory } from "./AccountAbstraction"
import { formatEther, parseEther, randomBytes, Wallet } from 'ethers';
import { AbiCoder, Contract, ethers, ZeroAddress } from "ethers";
import { it } from "mocha";
import { getWallet, getProvider, create2 } from "./utils";
import { assert, expect } from "chai";
import { concat, getPublicKeyBytes, toHash } from "./PasskeyModule";

import { Address, Hash, http } from "viem";
import { readFileSync } from "fs";
import { zksyncInMemoryNode } from "viem/chains";
import { createZksyncPasskeyClient } from "./sdk/PasskeyClient";
import { base64UrlToUint8Array, unwrapEC2Signature } from "./sdk/utils/passkey";
import { sendTransaction, waitForTransactionReceipt } from "viem/actions";

export const convertObjArrayToUint8Array = (objArray: {
    [key: string]: number;
}): Uint8Array => {
    const objEntries = Object.entries(objArray);
    return objEntries.reduce((existingArray, nextKv) => {
        const index = parseInt(nextKv[0]);
        existingArray[index] = nextKv[1];
        return existingArray;
    }, new Uint8Array(objEntries.length));
};

export class ContractFixtures {

    // eraTestNodeRichKey
    wallet = getWallet("0x3d3cbc973389cb26f657686445bcc75662b415b656078503592ac8c1abb8810e");

    readonly sessionKeyWallet = new Wallet("0xf51513036f18ef46508ddb0fff7aa153260ff76721b2f53c33fc178152fb481e")

    readonly staticRandomSalt = new Uint8Array([
        205, 241, 161, 186, 101, 105, 79,
        248, 98, 64, 50, 124, 168, 204,
        200, 71, 214, 169, 195, 118, 199,
        62, 140, 111, 128, 47, 32, 21,
        177, 177, 174, 166
    ])

    private _aaFactory: Contract;
    async getAaFactory() {
        if (!this._aaFactory) {
            this._aaFactory = await deployFactory("AAFactory", this.wallet);

            // FIXME: deploying a contract appears to allow the factory to deploy correctly
            // this is similar to the requirement to run a hardhat deploy before and ethers deploy
            await this.getProxyAccountContract();
        }
        return this._aaFactory;
    }

    private _passkeyModuleContract: Contract;

    async getPasskeyModuleContract() {
        if (!this._passkeyModuleContract) {
            this._passkeyModuleContract = await create2("SessionPasskeySpendLimitModule", this.wallet, this.staticRandomSalt, undefined);
            console.log("SessionPasskeySpendLimitModule", await this._passkeyModuleContract.getAddress())
        }
        return this._passkeyModuleContract
    }

    private _expensiveVerifierContract: Contract;
    async getExpensiveVerifierContract() {
        if (!this._expensiveVerifierContract) {
            this._expensiveVerifierContract = await create2("PasskeyValidator", this.wallet, this.staticRandomSalt, undefined);
            console.log("PasskeyValidator", await this._expensiveVerifierContract.getAddress());
        }
        return this._expensiveVerifierContract
    }
    private _accountImplContract: Contract;
    async getAccountImplContract() {
        if (!this._accountImplContract) {
            this._accountImplContract = await create2("ERC7579Account", this.wallet, this.staticRandomSalt, undefined)
            console.log("ERC7579Account", await this._accountImplContract.getAddress());
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
            this._proxyAccountContract = await create2("AccountProxy", this.wallet, this.staticRandomSalt, [claveAddress])
        }
        return this._proxyAccountContract;
    }


}

export class RecordedResponse {
    constructor(filename: string) {
        // loading directly from the response that was written (verifyAuthenticationResponse)
        const jsonFile = readFileSync(filename, 'utf-8')
        const responseData = JSON.parse(jsonFile)
        this.authenticatorData = responseData.response.response.authenticatorData;
        this.clientData = responseData.response.response.clientDataJSON;
        this.b64SignedChallenge = responseData.response.response.signature;
        this.passkeyBytes = convertObjArrayToUint8Array(responseData.authenticator.credentialPublicKey);
        this.xyPublicKey = getPublicKeyBytes(this.passkeyBytes);
    }

    // this is the encoded data explaining what authenticator was used (fido, web, etc)
    readonly authenticatorData: string;
    // this is a b64 encoded json object
    readonly clientData: string;
    // signed challange should come from signed transaction hash (challange is the transaction hash)
    readonly b64SignedChallenge: string;
    // This is a binary object formatted by @simplewebauthn that contains the alg type and public key
    readonly passkeyBytes: Uint8Array;
    // this is jut the public key in xy format without the alg type
    readonly xyPublicKey: Buffer;
}

describe.only("Spend limit validation", function () {

    const fixtures = new ContractFixtures()
    const ethersResponse = new RecordedResponse("test/signed-challenge.json")

    const abiCoder = new AbiCoder();

    // that needs to be converted from 77 to 64 bytes (32x2)
    const provider = getProvider();

    interface TokenConfig {
        token: string; // address
        publicKey: Buffer; // bytes
        limit: ethers.BigNumberish; // uint256
    }

    const tokenConfig: TokenConfig =
    {
        token: "0xAe045DE5638162fa134807Cb558E15A3F5A7F853",
        publicKey: ethersResponse.xyPublicKey,
        limit: ethers.toBigInt(1000)
    };
    // Define the types array corresponding to the struct
    const tokenConfigTypes = [
        "address", // token
        "bytes",   // publicKey
        "uint256"  // limit
    ];
    const moduleData = abiCoder.encode(
        [`tuple(${tokenConfigTypes.join(",")})[]`], // Solidity equivalent: TokenConfig[]
        [[tokenConfig].map(config => [
            config.token,
            config.publicKey,
            config.limit
        ])]
    );

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
            ethersResponse.xyPublicKey,
            expensiveVerifierContract,
            await passkeyModule.getAddress(),
            moduleData
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

        console.log("Account contract address", proxyAccountTxReceipt.contractAddress);

        expect(proxyAccountAddress, "the proxy account location via logs").to.not.equal(ZeroAddress, "be a valid address");
        expect(proxyAccountTxReceipt.contractAddress, "the proxy account location via return").to.not.equal(ZeroAddress, "be a non-zero address");
    });

    it("should add passkey and verifier to account", async () => {
        //
        // PART ONE: Initialize ClaveAccount implemention, verifier module, spendlimit module, and factory
        //
        const aaFactoryContract = await fixtures.getAaFactory();
        assert(aaFactoryContract != null, "Nsigning payload hash as binary 0x85e81b99252c685db945df7ee4dc7219b8480b3b39b9c66dbcb8e3a0fe6aec4a hegbmSUsaF25Rd9+5NxyGbhICzs5ucZtvLjjoP5q7Eo= Uint8Array(32) o AA Factory deployed");

        // Need to better wrap: 0x100. otherwise gas is high!
        const verifierContract = await fixtures.getExpensiveVerifierContract();
        const expensiveVerifierAddress = await verifierContract.getAddress();

        const moduleAddress = await (await fixtures.getPasskeyModuleContract()).getAddress();
        //
        // PART TWO: Install Module with passkey (salt needs to be random to not collide with other tests)
        //
        const proxyAccount = await aaFactoryContract.deployProxy7579Account(
            randomBytes(32),
            await fixtures.getAccountImplAddress(),
            ethersResponse.xyPublicKey,
            expensiveVerifierAddress,
            moduleAddress,
            moduleData
        );
        const proxyAccountTxReceipt = await proxyAccount.wait();

        assert(proxyAccountTxReceipt.contractAddress != ethers.ZeroAddress, "valid proxy account address");
    });

    it("should set spend limit via module with ethers", async () => {
        const verifierContract = await fixtures.getExpensiveVerifierContract();
        const expensiveVerifierAddress = await verifierContract.getAddress();
        const moduleContract = await fixtures.getPasskeyModuleContract();
        const moduleAddress = await moduleContract.getAddress();
        const factory = await fixtures.getAaFactory()
        const accountImpl = await fixtures.getAccountImplAddress()

        const proxyAccount = await factory.deployProxy7579Account(
            fixtures.staticRandomSalt,
            accountImpl,
            ethersResponse.xyPublicKey,
            expensiveVerifierAddress,
            moduleAddress,
            moduleData
        );

        const proxyAccountReciept = await proxyAccount.wait();
        const proxyAccountAddress = proxyAccountReciept.contractAddress;
        assert.notEqual(proxyAccountAddress, undefined, "no address set")
        console.log("proxyAccountAddress ", proxyAccountAddress)
        await (
            await fixtures.wallet.sendTransaction({
                to: proxyAccountAddress,
                value: parseEther('0.002'),
            })
        ).wait();


        const authDataBuffer = base64UrlToUint8Array(ethersResponse.authenticatorData);
        const clientDataBuffer = base64UrlToUint8Array(ethersResponse.clientData);
        // the validator needs to perform the following steps so it can validate the raw client data
        // performing this client side is just a helpful check to ensure the contract is following
        const clientDataHash = await toHash(clientDataBuffer);
        const hashedData = await toHash(concat([authDataBuffer, clientDataHash]));
        console.log("hashedData", hashedData)

        const rs = unwrapEC2Signature(base64UrlToUint8Array(ethersResponse.b64SignedChallenge))
        // steps to get the data for this test
        // 1. build the transaction here in the test (aaTx)
        // 2. use this sample signer to get the transaction hash of a realistic transaction
        // 3. take that transaction hash to another app, and sign it (as the challange)
        // 4. bring that signed hash back here and have it returned as the signer
        const isTestMode = false;
        const extractSigningHash = (hash: string, secretKey, provider) => {
            const b64Hash = ethers.encodeBase64(hash)
            console.log("signing payload hash (hex, b64, byte array)", hash, b64Hash, ethers.decodeBase64(b64Hash));
            if (isTestMode) {
                return Promise.resolve<string>(b64Hash);
            } else {
                // the validator is now responsible for checking and hashing this
                const fatSignature = abiCoder.encode(["bytes", "bytes", "bytes32[2]"], [
                    authDataBuffer,
                    clientDataBuffer,
                    [rs.r, rs.s]
                ])
                console.log("fatSignature", fatSignature, "length", fatSignature.length)
                // clave expects sigature + validator address + validator hook data
                const fullFormattedSig = abiCoder.encode(["bytes", "address", "bytes[]"], [
                    fatSignature,
                    expensiveVerifierAddress,
                    []
                ]);

                console.log("fullFormattedSig", fullFormattedSig, "length", fullFormattedSig.length)
                return Promise.resolve<string>(fullFormattedSig);
            }
        }

        // smart account secret isn't stored in javascript (because it's a passkey)
        // but we do have sessionkey secret
        const ethersTestSmartAccount = new SmartAccount({
            payloadSigner: extractSigningHash,
            address: proxyAccountAddress,
            secret: fixtures.sessionKeyWallet.privateKey
        }, getProvider())

        const callData = moduleContract.interface.encodeFunctionData('addSessionKey', [fixtures.sessionKeyWallet.address, tokenConfig.token, 100]);
        const aaTx = {
            type: 113,
            from: proxyAccountAddress,
            to: moduleAddress as Address,
            data: callData as Address, // not address?
            chainId: (await provider.getNetwork()).chainId,
            nonce: await provider.getTransactionCount(proxyAccountAddress),
            gasPrice: await provider.getGasPrice(),
            customData: {
                gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
            } as types.Eip712Meta,
        };

        aaTx['gasLimit'] = await provider.estimateGas(aaTx);

        const signedTransaction = await ethersTestSmartAccount.signTransaction(aaTx);
        assert(signedTransaction != null, "valid transaction to sign")

        await provider.broadcastTransaction(signedTransaction)
    })

    it.only("should set spend limit via module with viem", async () => {
        const viemAccountSalt = new Uint8Array([
            0, 0, 0, 0, 0, 0, 0,
            248, 98, 64, 50, 124, 168, 204,
            200, 71, 214, 169, 195, 118, 199,
            62, 140, 111, 128, 47, 32, 21,
            177, 177, 174, 166
        ])
        const verifierContract = await fixtures.getExpensiveVerifierContract();
        const expensiveVerifierAddress = await verifierContract.getAddress();
        const moduleContract = await fixtures.getPasskeyModuleContract();
        const moduleAddress = await moduleContract.getAddress();
        const factory = await fixtures.getAaFactory()
        const accountImpl = await fixtures.getAccountImplAddress()
        const viemResponse = new RecordedResponse("test/signed-viem-challenge.json")

        console.log("deployProxy7579Account for viem")
        const proxyAccount = await factory.deployProxy7579Account(
            viemAccountSalt,
            accountImpl,
            viemResponse.xyPublicKey,
            expensiveVerifierAddress,
            moduleAddress,
            moduleData
        );

        const proxyAccountReciept = await proxyAccount.wait();
        const proxyAccountAddress = proxyAccountReciept.contractAddress;
        assert.notEqual(proxyAccountAddress, undefined, "no address set")
        await (
            await fixtures.wallet.sendTransaction({
                to: proxyAccountAddress,
                value: parseEther('0.07'),
            })
        ).wait();

        const passkeyClient = createZksyncPasskeyClient({
            address: proxyAccountAddress as Address,
            chain: zksyncInMemoryNode,
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

        const callData = moduleContract.interface.encodeFunctionData('addSessionKey', [fixtures.sessionKeyWallet.address, tokenConfig.token, 100]);

        const transactionHash = await sendTransaction(passkeyClient, {
            address: moduleAddress as Address,
            account: (passkeyClient as any).account,
            chain: zksyncInMemoryNode,
            to: moduleAddress as Address,
            nonce: await provider.getTransactionCount(proxyAccountAddress),
            kzg: undefined as any,
            data: callData as Hash,
            /* gas: BigInt(aaTx['gasLimit']),
            gasPrice: BigInt(aaTx['gasPrice']),
            gasPerPubdata: BigInt(utils.DEFAULT_GAS_PER_PUBDATA_LIMIT), */
        });

        console.log({ transactionHash });
        const receipt2 = await waitForTransactionReceipt(passkeyClient, { hash: transactionHash });
        console.log({ receipt2 });
    })
})