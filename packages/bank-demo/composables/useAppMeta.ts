import { useStorage } from "@vueuse/core";
import type { Address } from "viem";

export interface AppMetadata {
  name: string;
  icon: string | null;
  credentialPublicKey: string | null;
  cryptoAccountAddress: `0x${string}` | null;
  hasCompletedInitialTransfer: boolean;
  hasCompletedAaveStake: boolean;
}

export const useAppMeta = () => {
  const appMetaStorage = useStorage<AppMetadata>("app-meta", {
    name: "",
    icon: null,
    // Uint8Array from your Passkey
    credentialPublicKey: null,
    // Account address that got created
    cryptoAccountAddress: null,
    // Have you purchased any ETH?
    hasCompletedInitialTransfer: false,
    // Have you staked any ETH?
    hasCompletedAaveStake: false,
  });

  const config = useRuntimeConfig();
  return {
    appMeta: appMetaStorage,
    userDisplay: "Jane Doe",
    userId: "jdoe",
    contracts: {
      accountFactory: config.public.accountFactory as Address,
      passkey: config.public.passkey as Address,
      session: config.public.session as Address,
    },
    deployerKey: config.public.bankDemoDeployerKey,
    aaveAddress: config.public.aaveAddress as Address,
    explorerUrl: config.public.explorerUrl,
  };
};
