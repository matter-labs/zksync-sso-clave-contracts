<template>
  <div>
    <button
      class="mx-auto text-center w-max px-4 py-2 flex items-center gap-1 text-sm text-neutral-800 hover:text-neutral-400 transition-colors"
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
  </div>
</template>

<script setup lang="ts">
import { ChevronDownIcon } from "@heroicons/vue/24/outline";
import type { SessionConfig } from "zksync-sso/utils";

const advancedInfoOpened = ref(false);

defineProps<{
  sessionConfig: Omit<SessionConfig, "signer">;
}>();
</script>
