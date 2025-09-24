import "@nomicfoundation/hardhat-toolbox";

import { ethers } from "ethers";
import { readFileSync } from "fs";
import hre from "hardhat";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import path from "path";
import { Wallet } from "zksync-ethers";

import { create2, ethersStaticSalt } from "../test/utils";
import { getDeployer } from "./deploy";

type Addr = `0x${string}`;

function readJsonAddresses(): Partial<Record<string, string>> {
  try {
    const eraJsonPath = path.resolve(__dirname, "..", "..", "..", "packages", "auth-server", "stores", "era-sepolia.json");
    const raw = readFileSync(eraJsonPath, "utf-8");
    const j = JSON.parse(raw);
    return j;
  } catch {
    return {};
  }
}

function nz(addr?: string): addr is Addr {
  return !!addr && /^0x[0-9a-fA-F]{40}$/.test(addr) && addr !== "0x0000000000000000000000000000000000000000";
}

async function deployGroth16Verifier(deployer: Wallet): Promise<Addr> {
  const contract = await create2("Groth16Verifier", deployer, ethersStaticSalt, []);
  const addr = (await contract.getAddress()) as Addr;
  console.log("Groth16Verifier deployed at:", addr);
  return addr;
}

async function main() {
  const initGuardian = (process.env.INIT_GUARDIAN || "").toLowerCase() === "true" || process.env.INIT_GUARDIAN === "1";
  const initOidc = (process.env.INIT_OIDC || "").toLowerCase() === "true" || process.env.INIT_OIDC === "1";
  const deployVerifierFlag = (process.env.DEPLOY_VERIFIER || "").toLowerCase() === "true" || process.env.DEPLOY_VERIFIER === "1";
  const simulateOnly = (process.env.SIMULATE_ONLY || "").toLowerCase() === "true" || process.env.SIMULATE_ONLY === "1";
  const compareDeployOidc = (process.env.COMPARE_DEPLOY_OIDC || "").toLowerCase() === "true" || process.env.COMPARE_DEPLOY_OIDC === "1";

  if (!initGuardian && !initOidc) {
    console.log("No actions requested. Set INIT_GUARDIAN=1 and/or INIT_OIDC=1 (optional: DEPLOY_VERIFIER=1, SIMULATE_ONLY=1, COMPARE_DEPLOY_OIDC=1).");
    return;
  }

  // Get deployer wallet using repo helper (reads .env, picks provider)
  const deployer = getDeployer(hre as unknown as HardhatRuntimeEnvironment, { fund: "0" }) as Wallet;
  console.log("Deployer:", await deployer.getAddress());

  // Resolve addresses from env, falling back to era-sepolia.json
  const j = readJsonAddresses();
  const guardianAddr = (process.env.GUARDIAN_ADDR || j["recovery"]) as string | undefined;
  const oidcAddr = (process.env.OIDC_ADDR || j["recoveryOidc"]) as string | undefined;
  const passkeyAddr = (process.env.PASSKEY_ADDR || j["passkey"]) as string | undefined;
  const keyRegistryAddr = (process.env.OIDC_KEY_REGISTRY_ADDR || j["oidcKeyRegistry"]) as string | undefined;
  let verifierAddr = (process.env.OIDC_VERIFIER_ADDR || j["oidcVerifier"]) as string | undefined; // may be absent

  if (initGuardian) {
    if (!nz(guardianAddr)) throw new Error("GUARDIAN_ADDR (or 'recovery' in era-sepolia.json) is required");
    if (!nz(passkeyAddr)) throw new Error("PASSKEY_ADDR (or 'passkey' in era-sepolia.json) is required");
    const guardian = await hre.ethers.getContractAt("GuardianRecoveryValidator", guardianAddr!, deployer);
    const wav = (await guardian.webAuthValidator()) as string;
    if (!nz(wav)) {
      console.log("Initializing GuardianRecoveryValidator with WebAuthValidator:", passkeyAddr);
      const tx = await guardian.initialize(passkeyAddr);
      await tx.wait();
      console.log("GuardianRecoveryValidator initialized.");
    } else {
      console.log("GuardianRecoveryValidator already initialized. webAuthValidator:", wav);
    }
  }

  if (initOidc) {
    if (!nz(oidcAddr)) throw new Error("OIDC_ADDR (or 'recoveryOidc' in era-sepolia.json) is required");
    if (!nz(passkeyAddr)) throw new Error("PASSKEY_ADDR (or 'passkey' in era-sepolia.json) is required");
    if (!nz(keyRegistryAddr)) throw new Error("OIDC_KEY_REGISTRY_ADDR (or 'oidcKeyRegistry' in era-sepolia.json) is required");

    const oidc = await hre.ethers.getContractAt("OidcRecoveryValidator", oidcAddr!, deployer);
    // Try reading via a non-admin call to avoid TransparentProxy admin fallback
    const iface = (await hre.artifacts.readArtifact("OidcRecoveryValidator")).abi;
    const i = new ethers.Interface(iface);
    const fromNonAdmin = "0x0000000000000000000000000000000000000001";
    async function readViaCall(selector: string): Promise<string> {
      const data = i.encodeFunctionData(selector, []);
      const provider = deployer.provider as unknown as ethers.Provider;
      const ret = await provider.call({ to: oidcAddr!, data, from: fromNonAdmin });
      const [val] = i.decodeFunctionResult(selector, ret);
      return val as string;
    }
    let wav: string, kr: string, vr: string;
    try {
      wav = await readViaCall("webAuthValidator");
      kr = await readViaCall("keyRegistry");
      vr = await readViaCall("verifier");
    } catch {
      // Fallback to normal reads if provider.call path fails
      wav = (await oidc.webAuthValidator()) as string;
      kr = (await oidc.keyRegistry()) as string;
      vr = (await oidc.verifier()) as string;
    }

    if (nz(wav) && nz(kr) && nz(vr)) {
      console.log("OidcRecoveryValidator already initialized.");
      console.log("  webAuthValidator:", wav);
      console.log("  keyRegistry:     ", kr);
      console.log("  verifier:        ", vr);
    } else {
      if (!nz(verifierAddr) && deployVerifierFlag) {
        verifierAddr = await deployGroth16Verifier(deployer);
      }
      if (!nz(verifierAddr)) throw new Error("OIDC_VERIFIER_ADDR missing. Pass env, add to era-sepolia.json, or set DEPLOY_VERIFIER=1.");
      console.log(simulateOnly ? "Simulating OidcRecoveryValidator initialize with:" : "Initializing OidcRecoveryValidator with:");
      console.log("  keyRegistry:", keyRegistryAddr);
      console.log("  verifier:   ", verifierAddr);
      console.log("  webAuth:    ", passkeyAddr);
      if (simulateOnly) {
        try {
          // ethers v6 contracts support staticCall on functions
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          await oidc.initialize.staticCall(keyRegistryAddr, verifierAddr, passkeyAddr);
          console.log("Simulation: initialize would succeed.");
        } catch (e) {
          const err = e as unknown as { reason?: string; shortMessage?: string; message?: string };
          const msg = (err?.reason || err?.shortMessage || err?.message || "").toString();
          console.log("Simulation revert:", msg);
        }
      } else {
        const tx = await oidc.initialize(keyRegistryAddr, verifierAddr, passkeyAddr);
        await tx.wait();
        console.log("OidcRecoveryValidator initialized.");
      }
      if (compareDeployOidc) {
        console.log("Deploying comparison OidcRecoveryValidator proxy (for reference readings)...");
        const impl = await create2("OidcRecoveryValidator", deployer, ethers.randomBytes(32), []);
        const implAddr = await impl.getAddress();
        const iface2 = (await hre.artifacts.readArtifact("OidcRecoveryValidator")).abi;
        const coder2 = new ethers.Interface(iface2);
        const initData = coder2.encodeFunctionData("initialize", [keyRegistryAddr, verifierAddr!, passkeyAddr]);
        const proxy = await create2("TransparentProxy", deployer, ethers.randomBytes(32), [implAddr, initData]);
        const proxyAddr = await proxy.getAddress();
        console.log("Comparison proxy deployed:", proxyAddr);
        // Read comparison via non-admin address to avoid fallback restriction
        const fromNonAdmin2 = "0x0000000000000000000000000000000000000002";
        const readCmp = async (sel: string) => {
          const data2 = i.encodeFunctionData(sel, []);
          const provider2 = deployer.provider as unknown as ethers.Provider;
          const ret2 = await provider2.call({ to: proxyAddr, data: data2, from: fromNonAdmin2 });
          const [val2] = i.decodeFunctionResult(sel, ret2);
          return val2 as string;
        };
        console.log("  cmp.webAuthValidator:", await readCmp("webAuthValidator"));
        console.log("  cmp.keyRegistry:     ", await readCmp("keyRegistry"));
        console.log("  cmp.verifier:        ", await readCmp("verifier"));
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
