import type { AppMetadata } from "zksync-account";
import { useStorage } from "@vueuse/core";

export const useAppMeta = () => {
  const route = useRoute();

  const appMetaStorage = useStorage<{ [origin: string]: AppMetadata }>("app-meta", {});
  const appMeta = computed({
    get: () => appMetaStorage.value[origin.value],
    set: (value) => {
      appMetaStorage.value[origin.value] = value;
    },
  });
  const domain = computed(() => new URL(origin.value).host);
  const origin = computed(() => route.query.origin as string);

  return {
    appMeta,
    domain,
    origin,
  };
};
