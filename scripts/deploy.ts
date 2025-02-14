import "@nomicfoundation/hardhat-toolbox";

import { ethers } from "ethers";
import { task } from "hardhat/config";
import { Wallet } from "zksync-ethers";

const WEBAUTH_NAME = "WebAuthValidator";
const SESSIONS_NAME = "SessionKeyValidator";
const GUARDIAN_RECOVERY_NAME = "GuardianRecoveryValidator";
const OIDC_RECOVERY_NAME = "OidcValidator";
const OIDC_VERIFIER_NAME = "Groth16Verifier";
const ACCOUNT_IMPL_NAME = "SsoAccount";
const FACTORY_NAME = "AAFactory";
const PAYMASTER_NAME = "ExampleAuthServerPaymaster";
const BEACON_NAME = "SsoBeacon";
const OIDC_KEY_REGISTRY_NAME = "OidcKeyRegistry";

async function deploy(name: string, deployer: Wallet, proxy: boolean, args?: any[], initArgs?: any): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { deployFactory, create2, ethersStaticSalt } = require("../test/utils");
  console.log("Deploying", name, "contract...");
  let implContract;
  if (name == FACTORY_NAME) {
    implContract = await deployFactory(deployer, args![0], ethersStaticSalt);
  } else {
    implContract = await create2(name, deployer, ethersStaticSalt, args);
  }
  const implAddress = await implContract.getAddress();
  if (!proxy) {
    console.log(name, "contract deployed at:", implAddress, "\n");
    return implAddress;
  }
  const proxyContract = await create2("TransparentProxy", deployer, ethersStaticSalt, [implAddress, initArgs ?? "0x"]);
  const proxyAddress = await proxyContract.getAddress();
  console.log(name, "proxy contract deployed at:", proxyAddress, "\n");
  return proxyAddress;
}

task("deploy", "Deploys ZKsync SSO contracts")
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
      if (!process.env.WALLET_PRIVATE_KEY) throw "Wallet private key wasn't found in .env file!";
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
      const webauth = await deploy(WEBAUTH_NAME, deployer, !cmd.noProxy);
      const sessions = await deploy(SESSIONS_NAME, deployer, !cmd.noProxy);
      const implementation = await deploy(ACCOUNT_IMPL_NAME, deployer, false);
      const beacon = await deploy(BEACON_NAME, deployer, false, [implementation]);
      const factory = await deploy(FACTORY_NAME, deployer, !cmd.noProxy, [beacon]);
      const guardianInterface = new ethers.Interface((await hre.artifacts.readArtifact(GUARDIAN_RECOVERY_NAME)).abi);
      const recovery = await deploy(GUARDIAN_RECOVERY_NAME, deployer, !cmd.noProxy, [webauth, factory], guardianInterface.encodeFunctionData("initialize", [webauth, factory]));
      const oidcKeyRegistryInterface = new ethers.Interface((await hre.artifacts.readArtifact(OIDC_KEY_REGISTRY_NAME)).abi);
      const oidcKeyRegistry = await deploy(OIDC_KEY_REGISTRY_NAME, deployer, !cmd.noProxy, [], oidcKeyRegistryInterface.encodeFunctionData("initialize", []));
      const oidcVerifier = await deploy(OIDC_VERIFIER_NAME, deployer, false, []);
      await deploy(OIDC_RECOVERY_NAME, deployer, !cmd.noProxy, [oidcKeyRegistry, oidcVerifier]);
      const paymaster = await deploy(PAYMASTER_NAME, deployer, false, [factory, sessions, recovery]);

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
      if (cmd.only == OIDC_KEY_REGISTRY_NAME) {
        args = [];
      }

      const deployedContract = await deploy(cmd.only, deployer, false, args);

      if (cmd.only == PAYMASTER_NAME) {
        await fundPaymaster(deployedContract, cmd.fund);
      }
    }
  });
