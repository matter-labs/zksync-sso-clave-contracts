<template>
  <div>
    <h2 class="text-2xl text-bold mt-4 dark:text-white">
      Input
    </h2>
    <ZkInput placeholder="Label" />
    <br>
    <ZkInput
      placeholder="Disabled"
      disabled
    />
    <br>
    <ZkInput
      placeholder="Label"
      post-label="@zksync.eth"
    />
    <br>
    <ZkInput
      placeholder="Loading"
      :loading="true"
    />
    <br>
    <ZkInput
      placeholder="Error"
      state="error"
      :messages="errorMessages"
    />
    <br>
    <ZkInput
      placeholder="Error"
      state="error"
      post-label="@zksync.eth"
    />
  </div>
</template>

<script setup lang="ts">
const errorMessages = [
  "Long error text that should be as long as the input and then wrap around.",
  "Secondary short text error message.",
];
</script>
