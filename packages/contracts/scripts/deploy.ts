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

async function deploy(name: string, deployer: Wallet, proxy: boolean, args?: any[]): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { deployFactory, create2 } = require("../test/utils");
  console.log("Deploying", name, "contract...");
  let implContract;
  if (name == "AAFactory") {
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
  .addOptionalParam("privateKey", "private key to the account to deploy the contracts from")
  .addOptionalParam("only", "name of a specific contract to deploy")
  .addFlag("noProxy", "do not deploy transparent proxies for factory and modules")
  .addOptionalParam("implementation", "address of the account implementation to use in the factory")
  .addOptionalParam("factory", "address of the factory to use in the paymaster")
  .addOptionalParam("sessions", "address of the sessions module to use in the paymaster")
  .addOptionalParam("fund", "amount of ETH to send to the paymaster", "0")
  .setAction(async (cmd, hre) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LOCAL_RICH_WALLETS, getProvider } = require("../test/utils");
    console.log("Deploying to:", hre.network.name);
    const provider = getProvider();

    let privateKey: string;
    if (cmd.privateKey) {
      privateKey = cmd.privateKey;
    } else if (hre.network.name == "inMemoryNode" || hre.network.name == "dockerizedNode") {
      console.log("Using local rich wallet");
      privateKey = LOCAL_RICH_WALLETS[0].privateKey;
      cmd.fund = "1";
    } else {
      throw new Error("Private key must be provided to deploy on non-local network");
    }

    const deployer = new Wallet(privateKey, provider);
    console.log("Deployer address:", deployer.address);

    if (!cmd.only) {
      await deploy("WebAuthValidator", deployer, !cmd.noProxy);
      const sessions = await deploy("SessionKeyValidator", deployer, !cmd.noProxy);
      const implementation = await deploy("SsoAccount", deployer, false);
      // TODO: enable proxy for factory -- currently it's not working
      const factory = await deploy("AAFactory", deployer, false, [implementation]);
      const paymaster = await deploy("ExampleAuthServerPaymaster", deployer, false, [factory, sessions]);

      if (cmd.fund != 0) {
        console.log("Funding paymaster with", cmd.fund, "ETH...");
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
    } else {
      let args: any[] = [];
      if (cmd.only == "AAFactory") {
        if (!cmd.implementation) {
          throw new Error("Implementation address must be provided to deploy factory");
        }
        args = [cmd.implementation];
      }
      if (cmd.only == "ExampleAuthServerPaymaster") {
        if (!cmd.factory || !cmd.sessions) {
          throw new Error("Factory and SessionModule addresses must be provided to deploy paymaster");
        }
        args = [cmd.factory, cmd.sessions];
      }
      await deploy(cmd.only, deployer, false, args);
    }
  });
