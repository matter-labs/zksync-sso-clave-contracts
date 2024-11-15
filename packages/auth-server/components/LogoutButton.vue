<template>
  <button
    class="w-6 h-6 text-neutral-400 hover:text-white transition"
    @click="logout()"
  >
    <ArrowLeftEndOnRectangleIcon />
  </button>
</template>

<script lang="ts" setup>
import { ArrowLeftEndOnRectangleIcon } from "@heroicons/vue/24/outline";

const { logout } = useAccountStore();
</script>
