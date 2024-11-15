<template>
  <ClientOnly>
    <ZkButtonIcon
      :icon="isDark ? 'bedtime' : 'sunny'"
      @click="isDark = !isDark"
    />
  </ClientOnly>
</template>

<script setup lang="ts">
const { isDark } = useAppColorMode();
</script>
