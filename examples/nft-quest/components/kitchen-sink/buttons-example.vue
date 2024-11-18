<template>
  <div>
    <h2 class="text-2xl text-bold mt-4 dark:text-white">
      Buttons
    </h2>

    <h3 class="text-xl text-bold mt-3 dark:text-white">
      Primary
    </h3>
    <ZkButton>Primary Button</ZkButton>
    <ZkButton disabled>
      Primary Disabled
    </ZkButton>

    <h3 class="text-xl text-bold mt-3 dark:text-white">
      Secondary
    </h3>
    <ZkButton type="secondary">
      Secondary Button
    </ZkButton>
    <ZkButton
      type="secondary"
      disabled
    >
      Secondary Disabled
    </ZkButton>

    <h3 class="text-xl text-bold mt-3 dark:text-white">
      Tertiary
    </h3>
    <ZkButton type="tertiary">
      Tertiary Button
    </ZkButton>
    <ZkButton
      type="tertiary"
      disabled
    >
      Tertiary Disabled
    </ZkButton>

    <h3 class="text-xl text-bold mt-3 dark:text-white">
      Danger
    </h3>
    <ZkButton type="danger">
      Danger Button
    </ZkButton>
    <ZkButton
      type="danger"
      disabled
    >
      Danger Disabled
    </ZkButton>

    <h3 class="text-xl text-bold mt-3 dark:text-white">
      Ghost
    </h3>
    <ZkButton type="ghost">
      Ghost Button
    </ZkButton>
    <ZkButton
      type="ghost"
      disabled
    >
      Ghost Disabled
    </ZkButton>

    <h3 class="text-xl text-bold mt-3 dark:text-white">
      With icon
    </h3>
    <ZkButton type="primary">
      <template #prefix>
        <ZkIcon
          icon="switch_access_shortcut"
          ui="rotate-90"
        />
      </template>
      Button with icon
    </ZkButton>
    <ZkButton type="ghost">
      <template #prefix>
        <ZkIcon icon="open_in_new" />
      </template>
      Button with icon
    </ZkButton>

    <h3 class="text-xl text-bold mt-3 dark:text-white">
      Loading
    </h3>

    <ZkButton
      type="primary"
      loading
    >
      Loading Button
    </ZkButton>
  </div>
</template>

<script setup lang="ts">
</script>
