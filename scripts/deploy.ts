import "@nomicfoundation/hardhat-toolbox";

import { ethers } from "ethers";
import { task } from "hardhat/config";
import { Wallet } from "zksync-ethers";

const ethersStaticSalt = new Uint8Array([
  205, 241, 161, 186, 101, 105, 79,
  248, 98, 64, 50, 124, 168, 204,
  200, 71, 214, 169, 195, 118, 199,
  62, 140, 111, 128, 47, 32, 21,
  177, 177, 174, 166,
]);

const WEBAUTH_NAME = "WebAuthValidator";
const SESSIONS_NAME = "SessionKeyValidator";
const ACCOUNT_IMPL_NAME = "SsoAccount";
const FACTORY_NAME = "AAFactory";
const PAYMASTER_NAME = "ExampleAuthServerPaymaster";
const BEACON_NAME = "SsoBeacon";

async function deploy(name: string, deployer: Wallet, proxy: boolean, args?: any[]): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { deployFactory, create2 } = require("../test/utils");
  console.log("Deploying", name, "contract...");
  let implContract;
  if (name == FACTORY_NAME) {
    implContract = await deployFactory(deployer, args![0]);
  } else {
    implContract = await create2(name, deployer, ethersStaticSalt, args);
  }
  const implAddress = await implContract.getAddress();
  if (!proxy) {
    console.log(name, "contract deployed at:", implAddress, "\n");
    return implAddress;
  }
  const proxyContract = await create2("TransparentProxy", deployer, ethersStaticSalt, [implAddress]);
  const proxyAddress = await proxyContract.getAddress();
  console.log(name, "proxy contract deployed at:", proxyAddress, "\n");
  return proxyAddress;
}


task("deploy", "Deploys ZKsync SSO contracts")
  .addOptionalParam("privatekey", "private key to the account to deploy the contracts from")
  .addOptionalParam("only", "name of a specific contract to deploy")
  .addFlag("noProxy", "do not deploy transparent proxies for factory and modules")
  .addOptionalParam("implementation", "address of the account implementation to use in the beacon")
  .addOptionalParam("factory", "address of the factory to use in the paymaster")
  .addOptionalParam("sessions", "address of the sessions module to use in the paymaster")
  .addOptionalParam("beacon", "address of the beacon to use in the factory")
  .addOptionalParam("fund", "amount of ETH to send to the paymaster", "0")
  .setAction(async (cmd, hre) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LOCAL_RICH_WALLETS, getProvider } = require("../test/utils");
    console.log("Deploying to:", hre.network.name);
    const provider = getProvider();

    let privateKey: string;
    if (hre.network.name == "inMemoryNode" || hre.network.name == "dockerizedNode") {
      console.log("Using local rich wallet");
      privateKey = LOCAL_RICH_WALLETS[0].privateKey;
      cmd.fund = "1";
    } else {
      if (!process.env.WALLET_PRIVATE_KEY) throw "⛔️ Wallet private key wasn't found in .env file!";
      privateKey = process.env.WALLET_PRIVATE_KEY;
    }

    const deployer = new Wallet(privateKey, provider);
    console.log("Deployer address:", deployer.address);

    async function fundPaymaster(paymaster: string, fund?: string | number) {
      if (fund && fund != 0) {
        console.log("Funding paymaster with", fund, "ETH...");
        await (
          await deployer.sendTransaction({
            to: paymaster,
            value: ethers.parseEther(cmd.fund),
          })
        ).wait();
        console.log("Paymaster funded\n");
      } else {
        console.log("--fund flag not provided, skipping funding paymaster\n");
      }
    }

    if (!cmd.only) {
      await deploy(WEBAUTH_NAME, deployer, !cmd.noProxy);
      const sessions = await deploy(SESSIONS_NAME, deployer, !cmd.noProxy);
      const implementation = await deploy(ACCOUNT_IMPL_NAME, deployer, false);
      const beacon = await deploy(BEACON_NAME, deployer, false, [implementation]);
      const factory = await deploy(FACTORY_NAME, deployer, !cmd.noProxy, [beacon]);
      const paymaster = await deploy(PAYMASTER_NAME, deployer, false, [factory, sessions]);

      await fundPaymaster(paymaster, cmd.fund);
    } else {
      let args: any[] = [];

      if (cmd.only == BEACON_NAME) {
        if (!cmd.implementation) {
          throw "Account implementation (--implementation <value>) address must be provided to deploy beacon";
        }
        args = [cmd.implementation];
      }
      if (cmd.only == FACTORY_NAME) {
        if (!cmd.implementation) {
          throw "Beacon (--beacon <value>) address must be provided to deploy factory";
        }
        args = [cmd.implementation];
      }
      if (cmd.only == PAYMASTER_NAME) {
        if (!cmd.factory || !cmd.sessions) {
          throw "Factory (--factory <value>) and SessionModule (--sessions <value>) addresses must be provided to deploy paymaster";
        }
        args = [cmd.factory, cmd.sessions];
      }
      const deployedContract = await deploy(cmd.only, deployer, false, args);

      if (cmd.only == PAYMASTER_NAME) {
        await fundPaymaster(deployedContract, cmd.fund);
      }
    }
  });
