import { useStorage } from "@vueuse/core";
import type { AppMetadata } from "zksync-sso";

export const useAppMeta = () => {
  const route = useRoute();
  const appOrigin = useStorage<string>("app-origin", route.query.origin! as string, sessionStorage);

  const appMetaStorage = useStorage<{ [origin: string]: AppMetadata }>("app-meta", {});
  const appMeta = computed({
    get: () => appMetaStorage.value[appOrigin.value],
    set: (value) => {
      appMetaStorage.value[appOrigin.value] = value;
    },
  });
  const domain = computed(() => new URL(appOrigin.value).host);

  return {
    appOrigin,
    appMeta,
    domain,
  };
};
