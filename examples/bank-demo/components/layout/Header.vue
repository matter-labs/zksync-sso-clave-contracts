<template>
  <div class="flex items-center py-4 dark:text-neutral-100">
    <div class="text-[2.5rem] flex-auto">
      <slot />
    </div>
    <div class="text-base">
      <slot name="aside" />
    </div>
  </div>
</template>

<script setup lang="ts"></script>
