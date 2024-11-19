<template>
  <NuxtLink v-bind="$props" :class="linkUI">
    <slot/>
  </NuxtLink>
</template>

<script setup lang="ts">
const linkUI = "inline-block inline-flex items-center justify-center border border-transparent px-4 py-3 align-middle leading-3 focus:outline-none focus:ring-4 focus:ring-primary-400 focus:ring-opacity-50 rounded-full text-neutral-500 hover:bg-white hover:text-neutral-800";
</script>

<style>
.router-link-exact-active {
  @apply bg-white text-neutral-800
}
</style>
