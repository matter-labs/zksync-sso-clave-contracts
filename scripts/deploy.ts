import "@nomicfoundation/hardhat-toolbox";

import { ethers } from "ethers";
import { writeFileSync } from "fs";
import { task } from "hardhat/config";
import { Artifact } from "hardhat/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet } from "zksync-ethers";

const WEBAUTH_NAME = "WebAuthValidator";
const SESSIONS_NAME = "SessionKeyValidator";
const OIDC_RECOVERY_NAME = "OidcRecoveryValidator";
const OIDC_VERIFIER_NAME = "Groth16Verifier";
const ACCOUNT_IMPL_NAME = "SsoAccount";
const FACTORY_NAME = "AAFactory";
const PAYMASTER_NAME = "ExampleAuthServerPaymaster";
const BEACON_NAME = "SsoBeacon";
export const GUARDIAN_RECOVERY_NAME = "GuardianRecoveryValidator";
const OIDC_KEY_REGISTRY_NAME = "OidcKeyRegistry";

async function deploy(name: string, deployer: Wallet, proxy: boolean, args?: any[], initArgs?: any): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { deployFactory, create2, ethersStaticSalt } = require("../test/utils");
  console.log("Deploying", name, "contract...");
  let implContract;
  if (name == FACTORY_NAME) {
    implContract = await deployFactory(deployer, args![0], args![1], args![2], ethersStaticSalt);
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

async function deployKeyRegistry(deployer: Wallet, keyRegistryOwner: Wallet, hre: HardhatRuntimeEnvironment, noProxy: boolean) {
  const keyRegistry = await deploy(OIDC_KEY_REGISTRY_NAME, deployer, !noProxy);
  const keyRegistryContract = await hre.ethers.getContractAt(OIDC_KEY_REGISTRY_NAME, keyRegistry, keyRegistryOwner);
  try {
    await keyRegistryContract.initialize();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    console.log("Key registry already initialized\n");
  }
  return keyRegistry;
}

function getKeyRegistryOwner() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LOCAL_RICH_WALLETS, getProvider } = require("../test/utils");
  const provider = getProvider();
  return new Wallet(LOCAL_RICH_WALLETS[1].privateKey, provider);
}

async function fundPaymaster(deployer: Wallet, paymaster: string, fund?: string | number) {
  if (fund && fund != 0) {
    console.log("Funding paymaster with", fund, "ETH...");
    await (
      await deployer.sendTransaction({
        to: paymaster,
        value: ethers.parseEther(fund.toString()),
      })
    ).wait();
    console.log("Paymaster funded\n");
  } else {
    console.log("--fund flag not provided, skipping funding paymaster\n");
  }
}

export function getDeployer(hre, cmd) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LOCAL_RICH_WALLETS, getProvider } = require("../test/utils");
  console.log("Deploying to:", hre.network.name);
  const provider = getProvider();

  if (hre.network.name == "inMemoryNode" || hre.network.name == "dockerizedNode") {
    console.log("Using local rich wallet");
    cmd.fund = "1";
    return new Wallet(LOCAL_RICH_WALLETS[0].privateKey, provider);
  } else {
    if (!process.env.WALLET_PRIVATE_KEY) throw "Wallet private key wasn't found in .env file!";
    return new Wallet(process.env.WALLET_PRIVATE_KEY, provider);
  }
}

interface DeployArgs {
  only?: string;
  noProxy?: boolean;
  implementation?: string;
  factory?: string;
  sessions?: string;
}

export function getArgs(cmd: DeployArgs) {
  if (!cmd.only) {
    return [];
  }
  if (cmd.only == BEACON_NAME) {
    if (!cmd.implementation) {
      throw "Account implementation (--implementation <value>) address must be provided to deploy beacon";
    }
    return [cmd.implementation];
  }
  if (cmd.only == FACTORY_NAME) {
    if (!cmd.implementation) {
      throw "Beacon (--beacon <value>) address must be provided to deploy factory";
    }
    return [cmd.implementation];
  }
  if (cmd.only == PAYMASTER_NAME) {
    if (!cmd.factory || !cmd.sessions) {
      throw "Factory (--factory <value>) and SessionModule (--sessions <value>) addresses must be provided to deploy paymaster";
    }
    return [cmd.factory, cmd.sessions];
  }

  throw `Unsupported '${cmd.only}' contract name. Use: ${BEACON_NAME}, ${FACTORY_NAME}, ${PAYMASTER_NAME}`;
}

export async function deployCmd(
  recoveryArtifact: Artifact,
  args: string[],
  deployer: Wallet,
  artifactName: string,
  noProxy: boolean,
  fund: number,
  file: string,
  hre: HardhatRuntimeEnvironment,
) {
  if (!artifactName) {
    const keyRegistryOwner = getKeyRegistryOwner();
    const passkey = await deploy(WEBAUTH_NAME, deployer, !noProxy);
    const session = await deploy(SESSIONS_NAME, deployer, !noProxy);
    const implementation = await deploy(ACCOUNT_IMPL_NAME, deployer, false);
    const beacon = await deploy(BEACON_NAME, deployer, false, [implementation]);
    const accountFactory = await deploy(FACTORY_NAME, deployer, !noProxy, [beacon, passkey, session]);
    const guardianInterface = new ethers.Interface(recoveryArtifact.abi);
    const recovery = await deploy(GUARDIAN_RECOVERY_NAME, deployer, !noProxy, [], guardianInterface.encodeFunctionData(
      "initialize(address)",
      [passkey],
    ));
    const oidcKeyRegistry = await deployKeyRegistry(deployer, keyRegistryOwner, hre, noProxy);
    const oidcRecoveryInterface = new ethers.Interface((await hre.artifacts.readArtifact(OIDC_RECOVERY_NAME)).abi);
    const oidcVerifier = await deploy(OIDC_VERIFIER_NAME, deployer, false, []);
    const recoveryOidc = await deploy(OIDC_RECOVERY_NAME, deployer, !noProxy, [], oidcRecoveryInterface.encodeFunctionData("initialize", [oidcKeyRegistry, oidcVerifier, passkey]));
    const accountPaymaster = await deploy(PAYMASTER_NAME, deployer, false, [accountFactory, session, recovery, passkey, recoveryOidc]);
    await fundPaymaster(deployer, accountPaymaster, fund);
    const deployedContracts = { beacon, session, passkey, accountFactory, accountPaymaster, recovery, recoveryOidc, oidcKeyRegistry };
    if (file) {
      writeFileSync(file, JSON.stringify(deployedContracts));
    }
    return deployedContracts;
  } else {
    const deployedContract = await deploy(artifactName, deployer, false, args);

    if (artifactName == PAYMASTER_NAME) {
      await fundPaymaster(deployer, deployedContract, fund);
    }

    return { artifactName: deployedContract };
  }
}

task("deploy", "Deploys ZKsync SSO contracts")
  .addOptionalParam("only", "name of a specific contract to deploy")
  .addFlag("direct", "do not deploy transparent proxies for factory and modules")
  .addOptionalParam("implementation", "address of the account implementation to use in the beacon")
  .addOptionalParam("factory", "address of the factory to use in the paymaster")
  .addOptionalParam("sessions", "address of the sessions module to use in the paymaster")
  .addOptionalParam("beacon", "address of the beacon to use in the factory")
  .addOptionalParam("fund", "amount of ETH to send to the paymaster", "0")
  .addOptionalParam("file", "where to save all contract locations (it not using only)")
  .setAction(async (cmd, hre) => {
    const recoveryArtifact = await hre.artifacts.readArtifact(GUARDIAN_RECOVERY_NAME);
    const args = getArgs(cmd);
    const deployer = getDeployer(hre, cmd);
    await deployCmd(
      recoveryArtifact,
      args,
      deployer,
      cmd.only,
      cmd.direct,
      cmd.fund,
      cmd.file,
      hre,
    );
  });
