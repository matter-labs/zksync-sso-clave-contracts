<template>
  <TransitionGroup
    v-bind="TransitionOpacity"
    tag="div"
    mode="out-in"
    class="h-dvh"
  >
    <ViewsLoading
      v-if="loading && !hasRequests"
      key="loading"
    />
    <ViewsAuth
      v-else-if="requestMethod === 'eth_requestAccounts'"
      key="login"
    />
    <ViewsConfirmation
      v-else
      key="confirmation"
    />
  </TransitionGroup>
</template>

<script lang="ts" setup>
const { isLoggedIn } = storeToRefs(useAccountStore());
const { hasRequests, requestMethod } = storeToRefs(useRequestsStore());

const loading = ref(true);

watch(requestMethod, () => {
  if (isLoggedIn.value && requestMethod.value === "eth_requestAccounts") {
    navigateTo({ path: "/confirm/connect" });
  } else {
    loading.value = false;
  }
});
</script>
