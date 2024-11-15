import { useColorMode } from "@vueuse/core";

export const useAppColorMode = () => {
  const mode = useColorMode({
    modes: {
      light: "light-mode",
      dark: "dark-mode",
    },
  });

  const isDark = ref(mode.value === "dark");

  watch(isDark, (dark) => {
    mode.value = dark ? "dark" : "light";
  });

  return {
    isDark,
  };
};
