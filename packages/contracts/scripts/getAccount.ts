// 0xD4C9C5401CB33917062DBC206bD614cea10ab8cf passkey exampleusername 0xBC989fDe9e54cAd2aB4392Af6dF60f04873A033A
import { utils, Wallet, Provider } from "zksync-ethers";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { writeFile, readFile, access } from 'node:fs/promises';

// load env file
import dotenv from "dotenv";
import { LOCAL_RICH_WALLETS } from "../test/utils";
dotenv.config();

export default async function (hre: HardhatRuntimeEnvironment) {

    /*
    await checkAddress(
        "passkey",
        "0x04FaEd9dCb8d7731d89fe94eb3cc8a29E0e10204",
        "4038",
        "0xBC989fDe9e54cAd2aB4392Af6dF60f04873A033A") 
        */

        /*
    await checkAddress(
        "passkey",
        "0xD4C9C5401CB33917062DBC206bD614cea10ab8cf",
        "exampleusername",
        "0xBC989fDe9e54cAd2aB4392Af6dF60f04873A033A")
        */
    await checkAddress(
        "passkey",
        "0x55C9400Ef6e7779433Dd4c5a0Cdb9514E5f43f96",
        "164,1,1,3,39,32,6,33,88,32,125,127,140,250,59,231,194,197,127,91,145,196,254,205,153,123,39,95,196,94,30,189,130,164,141,104,55,187,100,121,246,36",
        "0xBC989fDe9e54cAd2aB4392Af6dF60f04873A033A"
    )
}

async function checkAddress(
    appName: string,
    factoryAddress: string,
    userId: string,
    creator: string) {
    const deployerPrivateKey = LOCAL_RICH_WALLETS[0].privateKey;
    const provider = new Provider("http://localhost:8011");
    const wallet = new Wallet(deployerPrivateKey, provider);
    const factoryArtifact = JSON.parse(await readFile('artifacts-zk/src/AAFactory.sol/AAFactory.json', 'utf8'));
    const aaFactory = new ethers.Contract(factoryAddress, factoryArtifact.abi, wallet);
    const address = await aaFactory.accountMappings(appName, userId, creator);
    console.log("account result: ", address);
}