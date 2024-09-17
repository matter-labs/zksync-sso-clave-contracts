import { utils, Wallet, Provider, ContractFactory } from "zksync-ethers";
import * as ethers from "ethers";
import { assert, should } from 'chai';
import { promises } from "fs";
import { logInfo, logWarning } from "./utils";

export async function deployFactory(factoryName: string, wallet: Wallet, expectedAddress?: string): Promise<ethers.ethers.Contract> {
    const factoryArtifact = JSON.parse(await promises.readFile(`artifacts-zk/src/${factoryName}.sol/${factoryName}.json`, 'utf8'))
    const testAaArtifact = JSON.parse(await promises.readFile('artifacts-zk/src/Account.sol/Account.json', 'utf8'))
    const proxyAaArtifact = JSON.parse(await promises.readFile('artifacts-zk/src/AccountProxy.sol/AccountProxy.json', 'utf8'))

    const deployer = new ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, wallet)
    const factory = await deployer.deploy(utils.hashBytecode(testAaArtifact.bytecode), utils.hashBytecode(proxyAaArtifact.bytecode));
    const factoryAddress = await factory.getAddress();

    logInfo(`"${factoryName}" was successfully deployed to ${factoryAddress}`);

    if (expectedAddress && factoryAddress != expectedAddress) {
        logWarning(`${factoryName}.sol address is not the expected default address (${expectedAddress}).`);
        logWarning(`Please update the default value in your tests or restart Era Test Node. Proceeding with expected default address...`);
        return new ethers.Contract(expectedAddress, factoryArtifact.abi, wallet);
    }

    return new ethers.Contract(factoryAddress, factoryArtifact.abi, wallet);
}

describe("Account abstraction", function () {

    // era test node location
    const eraTestNodeRichKey = "0x3d3cbc973389cb26f657686445bcc75662b415b656078503592ac8c1abb8810e"
    const wallet = new Wallet(eraTestNodeRichKey, new Provider("http://localhost:8011"));
    it("should deploy AA factory", async function () {
        const aaFactory = await deployFactory("AAFactory", wallet)
        should().exist(aaFactory, "factory created")
    });

    it("should deploy AA factory and account", async function () {
        const aaFactory = await deployFactory("AAFactory", wallet)

        const owner = Wallet.createRandom();
        const appName = "randomApp9"
        const salt = ethers.ZeroHash;
        const userId = BigInt(Math.floor((Math.random() * 10000)))
        const tx = await aaFactory.deployLinkedSocialAccount(salt, userId.toString(), appName, owner.address);
        await tx.wait();
    });

    it("should deploy AA factory and account with funds", async function () {
        const aaFactory = await deployFactory("AAFactory", wallet)

        const owner = Wallet.createRandom();
        const appName = "hardhat-test"
        const salt = ethers.ZeroHash;
        const userId = BigInt(Math.floor((Math.random() * 10000)))
        const tx = await aaFactory.deployLinkedSocialAccount(salt, userId.toString(), appName, owner.address);
        await tx.wait();

        const abiCoder = new ethers.AbiCoder();
        const accountAddress = utils.create2Address(
            await aaFactory.getAddress(),
            await aaFactory.testAaBytecodeHash(),
            salt,
            abiCoder.encode(["address"], [owner.address]));

        const createdAccount = await aaFactory.accountMappings(appName, userId.toString(), wallet.address);

        const transaction = await (
            await wallet.sendTransaction({
                to: accountAddress,
                value: ethers.parseEther("0.02"),
            })
        ).wait();
    });

    it("should allow setting passkey after creation", async function () {
        const aaFactory = await deployFactory("AAFactory", wallet)

        const owner = Wallet.createRandom();
        const appName = "hardhat-test"
        const salt = ethers.ZeroHash;
        const userId = BigInt(Math.floor((Math.random() * 10000)))
        const tx = await aaFactory.deployLinkedSocialAccount(salt, userId.toString(), appName, owner.address);
        await tx.wait();

        const abiCoder = new ethers.AbiCoder();
        const accountAddress = utils.create2Address(
            await aaFactory.getAddress(),
            await aaFactory.testAaBytecodeHash(),
            salt,
            abiCoder.encode(["address"], [owner.address]));

        const accountMapping = await aaFactory.accountMappings(appName, userId.toString(), wallet.address);
        const createdAccount = accountMapping[0]
        const emptyCreatedLinkedPasskey = accountMapping[1]

        // should have an address, but not have a passkey set by default
        assert(createdAccount, "No account created")
        assert(emptyCreatedLinkedPasskey == ethers.ZeroAddress || emptyCreatedLinkedPasskey == '', "CLP == empty")

        const newPasskey = "public-passkey-test,1,2,3,4"
        const updateTx = await aaFactory.setLinkedEmbeddedAccountPasskey(
            appName,
            userId.toString(),
            createdAccount,
            wallet.address,
            newPasskey
        );
        await updateTx.wait();

        const accountMappingWithPasskey = await aaFactory.accountMappings(appName, userId.toString(), wallet.address);

        const createdAccountAfterPasskey = accountMappingWithPasskey[0]
        const createdLinkedPasskey = accountMappingWithPasskey[1]

        // should have an address, but not have a passkey set by default
        assert(createdAccountAfterPasskey, "No account!")
        assert(createdLinkedPasskey != ethers.ZeroAddress || createdLinkedPasskey != '', `CLP == zero: ${ethers.ZeroAddress}`,)
        assert(newPasskey == createdLinkedPasskey, 'mismatch')
    });
});