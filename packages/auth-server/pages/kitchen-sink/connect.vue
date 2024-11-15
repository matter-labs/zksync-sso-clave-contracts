<template>
  <div class="flex items-center justify-center h-full">
    <TransitionGroup
      v-bind="TransitionOpacity"
      tag="div"
      mode="out-in"
      class="w-full h-full xs:max-w-[450px] xs:h-max bg-neutral-950 xs:rounded-[32px] p-4"
    >
      <ViewsLogin
        v-if="!isLoggedIn"
        key="login"
      />
      <ViewsLoading
        v-else-if="!appMeta || !hasRequests"
        key="loading"
      />
      <ViewsConnect
        v-else-if="requestMethod === 'eth_requestAccounts'"
        key="connect"
      />
      <ViewsConfirmation
        v-else
        key="confirmation"
      />
    </TransitionGroup>
  </div>
</template>

<script lang="ts" setup>
// 420x600
</script>
