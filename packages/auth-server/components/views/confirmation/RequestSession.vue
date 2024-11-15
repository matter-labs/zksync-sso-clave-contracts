<template>
  <div class="h-dvh flex flex-col px-4">
    <AccountHeader
      v-if="isLoggedIn"
      message="Connecting with"
    />
    <div :class="[isLoggedIn ? '' : 'mt-8']">
      <div class="w-14 h-14 rounded-md bg-neutral-950 mx-auto flex-shrink-0">
        <img
          v-if="appMeta.icon"
          :src="appMeta.icon"
          :alt="appMeta.name"
          class="h-full w-full object-cover rounded-md"
        >
      </div>
      <h1 class="text-white text-center text-xl mt-2 font-semibold">
        Authorize {{ appMeta.name }}
      </h1>
      <p class="text-center border border-neutral-800 mt-2 mx-auto w-max px-4 py-1 rounded-3xl">
        {{ domain }}
      </p>
    </div>

    <div class="space-y-2 mt-4">
      <div class="bg-neutral-975 rounded-[28px]">
        <div class="px-5 py-2 text-neutral-400">
          Permissions
        </div>
        <CommonLine>
          <div class="divide-y divide-neutral-800">
            <div class="flex items-center gap-2 py-3 px-3">
              <IconsFingerprint class="w-7 h-7" />
              <div>Act on your behalf</div>
            </div>
            <div class="flex items-center gap-2 py-3 px-3">
              <IconsClock class="w-7 h-7" />
              <div>Expires {{ sessionExpiresIn }}</div>
            </div>
          </div>
        </CommonLine>
      </div>

      <SessionTokens :session="sessionConfig" />
    </div>

    <button
      class="mx-auto text-center w-max px-4 py-2 flex items-center gap-1 text-sm text-neutral-700 hover:text-neutral-300 transition-colors"
      @click="advancedInfoOpened = !advancedInfoOpened"
    >
      <span>{{ advancedInfoOpened ? 'Hide' : 'Show' }} advanced session info</span>
      <ChevronDownIcon
        class="w-4 h-4 transition-transform"
        :class="{ 'rotate-180': advancedInfoOpened }"
        aria-hidden="true"
      />
    </button>
    <CommonHeightTransition :opened="advancedInfoOpened">
      <CommonLine>
        <pre class="p-3 text-xs overflow-auto">{{ JSON.stringify(sessionConfig, null, 4) }}</pre>
      </CommonLine>
    </CommonHeightTransition>

    <CommonHeightTransition :opened="!!sessionError">
      <p class="py-1 text-sm text-error-300 text-center">
        <span>
          {{ sessionError }}
        </span>
      </p>
    </CommonHeightTransition>

    <div class="mt-auto">
      <div class="-mx-3 px-3 border-t border-neutral-800 flex gap-4 py-4 mt-2">
        <ZkButton
          class="w-full"
          type="secondary"
          @click="deny()"
        >
          Cancel
        </ZkButton>
        <ZkHighlightWrapper
          v-if="!isLoggedIn"
          class="w-full"
        >
          <ZkButton
            class="w-full"
            :loading="!appMeta || responseInProgress"
            data-testid="connect"
            @click="confirmConnection()"
          >
            Create
          </ZkButton>
        </ZkHighlightWrapper>
        <ZkButton
          v-else
          class="w-full"
          :loading="!appMeta || responseInProgress"
          data-testid="connect"
          @click="confirmConnection()"
        >
          Connect
        </ZkButton>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ChevronDownIcon } from "@heroicons/vue/24/outline";
import { useTimeAgo } from "@vueuse/core";
import { parseEther } from "viem";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import type { SessionPreferences } from "zksync-sso";
import { type ExtractReturnType, formatSessionPreferences, type Method, type RPCResponseMessage } from "zksync-sso/client-auth-server";
import { LimitType } from "zksync-sso/utils";

const props = defineProps({
  sessionPreferences: {
    type: Object as PropType<SessionPreferences>,
    required: true,
  },
});

const { appMeta, appOrigin } = useAppMeta();
const { isLoggedIn } = storeToRefs(useAccountStore());
const { createAccount } = useAccountCreate(computed(() => requestChain.value!.id));
const { respond, deny } = useRequestsStore();
const { responseInProgress, requestChain } = storeToRefs(useRequestsStore());
const { getClient } = useClientStore();

const defaults = {
  expiresAt: BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24), // 24 hours
  feeLimit: {
    limitType: LimitType.Lifetime,
    limit: parseEther("0.01"),
    period: 0n,
  },
};
const sessionConfig = computed(() => formatSessionPreferences(props.sessionPreferences, defaults));

const domain = computed(() => new URL(appOrigin.value).host);
const sessionExpiresIn = useTimeAgo(Number(sessionConfig.value.expiresAt) * 1000);

const advancedInfoOpened = ref(false);
const sessionError = ref("");

const confirmConnection = async () => {
  let response: RPCResponseMessage<ExtractReturnType<Method>>["content"];
  sessionError.value = "";

  try {
    if (!isLoggedIn.value) {
      // create a new account with initial session data
      const accountData = await createAccount(sessionConfig.value);

      response = {
        result: constructReturn(
          accountData!.address,
          accountData!.chainId,
          {
            sessionConfig: accountData!.sessionConfig!,
            sessionKey: accountData!.sessionKey!,
          },
        ),
      };
    } else {
      // create a new session for the existing account
      const client = getClient({ chainId: requestChain.value!.id });
      const sessionKey = generatePrivateKey();
      const session = {
        sessionKey,
        sessionConfig: {
          signer: privateKeyToAddress(sessionKey),
          ...sessionConfig.value,
        },
      };

      await client.createSession({ sessionConfig: session.sessionConfig });
      response = {
        result: constructReturn(
          client.account.address,
          client.chain.id,
          session,
        ),
      };
    }
  } catch (error) {
    if ((error as Error).message.includes("Passkey validation failed")) {
      sessionError.value = "Passkey validation failed";
    } else {
      sessionError.value = "Error during session creation. Please see console for more info.";
    }
    console.error(error);
    return;
  }

  if (response) {
    respond(() => response);
  }
};
</script>
