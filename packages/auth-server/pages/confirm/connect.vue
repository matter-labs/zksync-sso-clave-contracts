<template>
  <div class="h-[100dvh]">
    <ViewsLoading
      v-if="loading"
      key="loading"
    />
    <ViewsConnect
      v-else-if="requestMethod === 'eth_requestAccounts'"
      key="connect"
    />
    <ViewsConfirmationMethodNotSupported
      v-else
      key="unsupported"
      :method="requestMethod!"
    />
  </div>
</template>

<script lang="ts" setup>
const { requestMethod } = storeToRefs(useRequestsStore());
const { isLoggedIn } = storeToRefs(useAccountStore());
const route = useRoute();

const loading = computed(() => {
  // only display loading if the user is not logged in
  // and if they are not registering
  return !isLoggedIn.value && route.query.action !== "register";
});
</script>
