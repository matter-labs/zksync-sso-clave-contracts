import { SmartAccount, utils } from "zksync-ethers";
import { parseEther, randomBytes } from 'ethers';
import { AbiCoder, ethers, ZeroAddress } from "ethers";
import { it } from "mocha";
import { getProvider } from "./utils";
import { assert, expect } from "chai";

import {  ERC7579Account__factory } from "../typechain-types";
import { ContractFixtures } from "./EndToEndSpendLimit";

describe.only("Basic tests", function () {
    const fixtures = new ContractFixtures();
    const abiCoder = new AbiCoder();
    const provider = getProvider();
    let proxyAccountAddress: string;

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

        const proxyAccount = await aaFactoryContract.deployProxy7579Account(
            randomBytes(32),
            await fixtures.getAccountImplAddress(),
            'id',
            [],
            [],
            [fixtures.wallet.address],
        );
        const proxyAccountTxReceipt = await proxyAccount.wait();

        const newAddress = abiCoder.decode(["address"], proxyAccountTxReceipt!.logs[0].data);
        proxyAccountAddress = newAddress[0];

        expect(proxyAccountAddress, "the proxy account location via logs").to.not.equal(ZeroAddress, "be a valid address");
        expect(proxyAccountTxReceipt!.contractAddress, "the proxy account location via return").to.not.equal(ZeroAddress, "be a non-zero address");
    });

    it("should execute a simple transfer of ETH", async () => {
        const fundTx = await fixtures.wallet.sendTransaction({ value: parseEther("1.0"), to: proxyAccountAddress });
        await fundTx.wait();

        // FIXME: why does this return BAD_DATA?
        // const account = ERC7579Account__factory.connect(proxyAccountAddress, provider);
        // console.log(await account.k1IsOwner(fixtures.wallet.address));
        // const owners = await account.k1ListOwners()
        // console.log("owners", owners);

        const smartAccount = new SmartAccount({
            payloadSigner: async (hash) => fixtures.wallet.signingKey.sign(hash).serialized,
            address: proxyAccountAddress,
            secret: fixtures.wallet.privateKey
        }, provider);

        const aaTx = {
            type: 113,
            from: proxyAccountAddress,
            to: ZeroAddress,
            value: 0,// parseEther("0.5"),
            chainId: (await provider.getNetwork()).chainId,
            nonce: await provider.getTransactionCount(proxyAccountAddress),
            gasPrice: await provider.getGasPrice(),
            customData: { gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT }
        };

        aaTx['gasLimit'] = await provider.estimateGas(aaTx);

        const signedTransaction = await smartAccount.signTransaction(aaTx);
        assert(signedTransaction != null, "valid transaction to sign");

        const tx = await provider.broadcastTransaction(signedTransaction);
        await tx.wait();

        console.log(ethers.formatEther(await provider.getBalance(proxyAccountAddress)));
    })
})
