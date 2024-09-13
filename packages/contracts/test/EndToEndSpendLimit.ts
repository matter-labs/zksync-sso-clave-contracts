
import { SmartAccount, types, utils } from "zksync-ethers";
import { deployFactory } from "./AccountAbstraction"
import { formatEther, parseEther, randomBytes, Wallet } from 'ethers';
import { AbiCoder, Contract, ethers, ZeroAddress } from "ethers";
import { it } from "mocha";
import { getWallet, getProvider, create2 } from "./utils";
import { assert, expect } from "chai";
import { concat, getPublicKeyBytes, toBuffer, toHash, unwrapEC2Signature } from "./PasskeyModule";

import { Address, encodeAbiParameters, Hash, http, toHex } from "viem";
import { readFileSync } from "fs";
import { zksyncInMemoryNode } from "viem/chains";
import { createZksyncPasskeyClient } from "./sdk/PasskeyClient";
import { base64UrlToUint8Array, unwrapEC2Signature as unwrapEC2Signature2 } from "./sdk/utils/passkey";
import { sendTransaction, waitForTransactionReceipt, writeContract } from "viem/actions";

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
            //this._proxyAccountContract = await deployContract("AccountProxy", [claveAddress], { wallet: this.wallet });
            this._proxyAccountContract = await create2("AccountProxy", this.wallet, this.staticRandomSalt, [claveAddress])
        }
        return this._proxyAccountContract;
    }

    constructor() {
        // loading directly from the response that was written (verifyAuthenticationResponse)
        const jsonFile = readFileSync("test/signed-challenge.json", 'utf-8')
        const responseData = JSON.parse(jsonFile)
        this.authenticatorData = responseData.response.response.authenticatorData;
        this.clientData = responseData.response.response.clientDataJSON;
        this.b64SignedChallenge = responseData.response.response.signature;
        this.passkeyBytes = convertObjArrayToUint8Array(responseData.authenticator.credentialPublicKey); 
    }

    // this is the encoded data explaining what authenticator was used (fido, web, etc)
    readonly authenticatorData: string;
    // this is a b64 encoded json object
    readonly clientData: string;
    // signed challange should come from signed transaction hash (challange is the transaction hash)
    readonly b64SignedChallenge: string;
    // This is a binary object formatted by @simplewebauthn that contains the alg type and public key
    readonly passkeyBytes: Uint8Array;
}

describe.only("Spend limit validation", function () {

    const fixtures = new ContractFixtures()

    // let ERC7579 = new Interface(erc7579ABI);
    const abiCoder = new AbiCoder();

    // that needs to be converted from 77 to 64 bytes (32x2)
    const xyPublicKey = getPublicKeyBytes(fixtures.passkeyBytes);
    const provider = getProvider();

    interface TokenConfig {
        token: string; // address
        publicKey: Buffer; // bytes
        limit: ethers.BigNumberish; // uint256
    }

    const tokenConfig: TokenConfig =
    {
        token: "0xAe045DE5638162fa134807Cb558E15A3F5A7F853",
        publicKey: xyPublicKey,
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
            xyPublicKey,
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

        console.log("Contract address", proxyAccountTxReceipt.contractAddress);

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
            xyPublicKey,
            expensiveVerifierAddress,
            moduleAddress,
            moduleData
        );
        const proxyAccountTxReceipt = await proxyAccount.wait();

        assert(proxyAccountTxReceipt.contractAddress != ethers.ZeroAddress, "valid proxy account address");
    });

    it("should set spend limit via module", async () => {
        const verifierContract = await fixtures.getExpensiveVerifierContract();
        const expensiveVerifierAddress = await verifierContract.getAddress();
        const moduleContract = await fixtures.getPasskeyModuleContract();
        const moduleAddress = await moduleContract.getAddress();
        const factory = await fixtures.getAaFactory()
        const accountImpl = await fixtures.getAccountImplAddress()

        // from a fresh node
        let proxyAccountAddress = "0xFce6d9BF38eb7D14A9F76fAeC214bC19E868191c";
        const accountCode = await provider.getCode(proxyAccountAddress);
        if (!accountCode || accountCode == '0x') {
            const proxyAccount = await factory.deployProxy7579Account(
                fixtures.staticRandomSalt,
                accountImpl,
                xyPublicKey,
                expensiveVerifierAddress,
                moduleAddress,
                moduleData
            );

            const proxyAccountReciept = await proxyAccount.wait();
            proxyAccountAddress = proxyAccountReciept.contractAddress;
            assert.notEqual(proxyAccountAddress, undefined, "no address set")
            console.log(formatEther(await fixtures.wallet.getBalance()));
            await (
                await fixtures.wallet.sendTransaction({
                    to: proxyAccountAddress,
                    value: parseEther('0.07'),
                })
            ).wait();
        }

        const authDataBuffer = toBuffer(fixtures.authenticatorData);
        const clientDataBuffer = toBuffer(fixtures.clientData);
        // the validator needs to perform the following steps so it can validate the raw client data
        // performing this client side is just a helpful check to ensure the contract is following
        const clientDataHash = await toHash(clientDataBuffer);

        const rs = unwrapEC2Signature2(base64UrlToUint8Array(fixtures.b64SignedChallenge));
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
                const fatSignature = encodeAbiParameters(
                    [
                      { type: 'bytes' }, // authData
                      { type: 'bytes' }, // clientDataJson
                      { type: 'bytes32[2]' }, // signature (two elements)
                    ],
                    [toHex(base64UrlToUint8Array(fixtures.authenticatorData)), toHex(base64UrlToUint8Array(fixtures.clientData)), [toHex(rs.r), toHex(rs.s)]]
                )
                console.log("fat sig", fatSignature, "length", fatSignature.length)
                // clave expects sigature + validator address + validator hook data
                const fullFormattedSig2 = encodeAbiParameters(
                    [
                        { type: 'bytes' }, // fat signature
                        { type: 'address' }, // validator address
                        { type: 'bytes[]' }, // validator data
                    ],
                    [fatSignature, expensiveVerifierAddress as Address, []]
                );

                return Promise.resolve(fullFormattedSig2);
            }
        }

        const passkeyClient = createZksyncPasskeyClient({
            address: proxyAccountAddress as Address,
            chain: zksyncInMemoryNode,
            key: "wallet",
            name: "ZKsync Account Passkey Client",
            signHash: async () => ({
                authenticatorData: fixtures.authenticatorData,
                clientDataJSON: fixtures.clientData,
                signature: fixtures.b64SignedChallenge
            }),
            transport: http(),
            userDisplayName: "",
            userName: "",
        });
        
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

        const transactionHash2 = await sendTransaction(passkeyClient, {
            address: moduleAddress as Address,
            account: (passkeyClient as any).account,
            chain: zksyncInMemoryNode,
            to: moduleAddress as Address,
            nonce: aaTx['nonce'],
            kzg: undefined as any,
            data: callData as Hash,
            /* gas: BigInt(aaTx['gasLimit']),
            gasPrice: BigInt(aaTx['gasPrice']),
            gasPerPubdata: BigInt(utils.DEFAULT_GAS_PER_PUBDATA_LIMIT), */
        });

        console.log({transactionHash2});
        const receipt2 = await waitForTransactionReceipt(passkeyClient, { hash: transactionHash2 });
        console.log({receipt2});

        /* const signedTransaction = await ethersTestSmartAccount.signTransaction(aaTx);
        assert(signedTransaction != null, "valid transaction to sign")

        await provider.broadcastTransaction(signedTransaction) */
    })
})