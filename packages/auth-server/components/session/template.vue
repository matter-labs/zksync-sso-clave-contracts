<template>
  <div class="h-[100dvh] w-full flex flex-col">
    <div
      v-if="$slots.header"
      class="bg-neutral-900/70 border-b border-neutral-800 p-2"
    >
      <slot name="header" />
    </div>
    <div class="flex-grow p-4 overflow-y-auto">
      <slot />
    </div>
    <div class=" border-t border-neutral-800 p-4">
      <slot name="footer" />
    </div>
  </div>
</template>
