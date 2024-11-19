<template>
  <client-only>
    <ZkButtonIcon
      :icon="isDark ? 'bedtime' : 'sunny'"
      @click="isDark = !isDark"
    />
  </client-only>
</template>

<script setup lang="ts">
import { useColorMode } from "@vueuse/core";
const mode = useColorMode({
  modes: {
    light: "light-mode",
    dark: "dark-mode",
  },
});

const isDark = ref(mode.value === "dark");

watchEffect(() => {
  mode.value = isDark.value ? "dark" : "light";
});
</script>
