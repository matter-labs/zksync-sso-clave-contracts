<template>
  <SessionTemplate class="text-neutral-300">
    <template
      v-if="isLoggedIn"
      #header
    >
      <SessionAccountHeader message="Connecting with" />
    </template>

    <SessionMetadata
      :app-meta="appMeta"
      :domain="domain"
      size="sm"
    />

    <div class="space-y-2 mt-2">
      <div class="bg-neutral-975 rounded-[28px]">
        <div class="px-5 py-2 text-neutral-400">
          Permissions
        </div>
        <CommonLine class="text-neutral-100">
          <div class="divide-y divide-neutral-800">
            <div class="flex items-center gap-2 py-3 px-3">
              <IconsFingerprint class="w-7 h-7" />
              <div>Act on your behalf</div>
            </div>
            <div class="flex items-center gap-2 py-3 px-3">
              <IconsClock class="w-7 h-7" />
              <div>{{ sessionExpiry }}</div>
            </div>
          </div>
        </CommonLine>
      </div>
    </div>
    <SessionTokens
      :session="sessionConfig"
      class="mt-1"
    />

    <SessionAdvancedInfo :session-config="sessionConfig" />

    <template #footer>
      <CommonHeightTransition :opened="!!sessionError">
        <p class="pb-2 text-sm text-error-300">
          <span>
            {{ sessionError }}
          </span>
        </p>
      </CommonHeightTransition>
      <div class="flex gap-4">
        <ZkButton
          class="w-full"
          type="secondary"
          @click="deny()"
        >
          Cancel
        </ZkButton>
        <ZkHighlightWrapper
          :show-highlight="!isLoggedIn"
          class="w-full"
        >
          <ZkButton
            class="w-full"
            :loading="!appMeta || responseInProgress"
            data-testid="connect"
            @click="confirmConnection()"
          >
            Connect
          </ZkButton>
        </ZkHighlightWrapper>
      </div>
    </template>
  </SessionTemplate>
</template>

<script lang="ts" setup>
import { useNow } from "@vueuse/core";
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
const now = useNow({ interval: 5000 });
const sessionExpiry = computed(() => {
  const expiresAt = Number(sessionConfig.value.expiresAt) * 1000; // Convert to milliseconds
  const expiresDate = new Date(expiresAt);
  const nowDate = new Date(now.value);

  const isToday = expiresDate.toDateString() === nowDate.toDateString();

  const tomorrowDate = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate() + 1,
  );
  const isTomorrow = expiresDate.toDateString() === tomorrowDate.toDateString();

  const formatTime = (date: Date) => date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const formatDate = (date: Date) => date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const formatDateTime = (date: Date) => `${formatDate(date)} at ${formatTime(date)}`;

  if (isToday) return `Expires today at ${formatTime(expiresDate)}`;
  if (isTomorrow) return `Expires tomorrow at ${formatTime(expiresDate)}`;

  return `Expires on ${formatDateTime(expiresDate)}`;
});

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
