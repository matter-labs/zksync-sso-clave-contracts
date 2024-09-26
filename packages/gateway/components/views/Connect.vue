<template>
  <ViewsConfirmationRequestAccounts v-if="!session" />
  <ViewsConfirmationRequestSession
    v-else
    :session="session"
  />
</template>

<script lang="ts" setup>
import type { SessionPreferences } from "zksync-account";

const { request } = storeToRefs(useRequestsStore());

const session = computed<SessionPreferences | undefined>(() => {
  if (request.value?.content.action.method !== "eth_requestAccounts") return undefined;
  if ("session" in (request.value.content.action.params!)) {
    return request.value.content.action.params.session;
  }
  return undefined;
});
</script>
