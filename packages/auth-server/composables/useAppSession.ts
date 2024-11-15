import type { SessionPreferences } from "zksync-sso";

export const useAppSession = () => {
  const { request } = storeToRefs(useRequestsStore());

  const session = computed<SessionPreferences | undefined>(() => {
    if (request.value?.content.action.method !== "eth_requestAccounts") return undefined;
    if ("sessionPreferences" in (request.value.content.action.params!)) {
      return request.value.content.action.params.sessionPreferences as SessionPreferences;
    }
    return undefined;
  });

  return session;
};
