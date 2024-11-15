<template>
  <div class="h-full flex items-center justify-center py-10">
    <div class="w-max h-max appear-with-delay">
      <CommonSpinner class="w-16 h-16" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.appear-with-delay {
  @apply opacity-0;
  animation: appear 0.3s forwards 0.3s;
  @keyframes appear {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
}
</style>
