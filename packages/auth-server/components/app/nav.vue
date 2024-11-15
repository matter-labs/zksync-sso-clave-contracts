<template>
  <div
    class="border border-neutral-200 rounded-zk flex justify-between dark:border-neutral-700 dark:bg-neutral-900"
  >
    <div class="flex items-center pl-3">
      <NuxtLink to="/dashboard">
        <app-account-logo
          :height="24"
          class="dark:text-neutral-100"
        />
      </NuxtLink>
    </div>
    <div
      ref="menu-wrapper"
      class="flex-auto flex justify-center"
    >
      <div
        v-show="!showMobileMenu"
        ref="menu"
        class="flex"
      >
        <NuxtLink
          v-for="item in mainNav"
          :key="item.href"
          :href="item.href"
          class="w-fit border-y-2 border-transparent hover:border-b-neutral-500 px-5 py-3 text-neutral-600 hover:text-neutral-800 flex items-center dark:text-neutral-400 dark:hover:text-neutral-300"
        >
          <zk-icon
            :icon="item.icon"
            class="mr-2"
          />
          {{ item.name }}
        </NuxtLink>
      </div>
    </div>
    <div
      v-show="!showMobileMenu"
      class="flex items-center pr-2"
    >
      <app-color-mode />
    </div>
    <div
      v-show="showMobileMenu"
      class="flex items-center pr-2 min-h-[52px]"
    >
      <app-nav-mobile-menu />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useWindowSize } from "@vueuse/core";
import { onBeforeUnmount, onMounted, watch } from "vue";

const { width: windowWidth } = useWindowSize();
const menuWrapper = useTemplateRef("menu-wrapper");
const menu = useTemplateRef("menu");
const menuWidth = ref(0);
const { mainNav } = useNav();

const showMobileMenu = ref(false);

const checkWidths = () => {
  const menuWrapperWidth = menuWrapper.value?.offsetWidth || 0;
  if (menuWrapperWidth <= menuWidth.value) {
    showMobileMenu.value = true;
  } else {
    showMobileMenu.value = false;
  }
};

onMounted(() => {
  menuWidth.value = menu.value?.offsetWidth || 0;
  checkWidths();
  window.addEventListener("resize", checkWidths);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", checkWidths);
});

watch(windowWidth, checkWidths);
</script>

<style lang="postcss" scoped>
.router-link-exact-active {
  @apply border-b-neutral-700 text-neutral-900 dark:text-neutral-100 dark:border-b-neutral-200 dark:hover:text-neutral-100
}
</style>
