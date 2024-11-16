<template>
  <div
    v-if="showHighlight"
    class="highlight-effect"
  >
    <div class="highlight-effect-inner">
      <slot />
    </div>
  </div>
  <div v-else>
    <slot />
  </div>
</template>

<script lang="ts" setup>
const { showHighlight = true } = defineProps<{
  showHighlight?: boolean;
}>();
</script>

<style lang="scss" scoped>
.highlight-effect {
  position: relative;
  border-radius: 2rem;
  padding: 4px;
  margin: -4px;

  &::before, &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    background: linear-gradient(90deg, rgba(0,11,163,1) 0%, rgba(62,134,255,1) 26%, rgba(0,11,163,1) 52%, rgba(100,220,255,1) 78%, rgba(0,11,163,1) 100%);
    background-size: 400%;
    z-index: -1;
    animation: highlight-effect-glow 5s linear infinite;
    width: 100%;
    border-radius: 2rem;
  }
  &::after {
    filter: blur(9px);
    transform: translate3d(0, 0, 0); /* For Safari */
  }

  .highlight-effect-inner {
    border-radius: 4px;
  }
}

@keyframes highlight-effect-glow {
  0% { background-position: 0 0; }
  50% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}
</style>
