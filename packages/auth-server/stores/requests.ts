import type { AuthServerRpcSchema, ExtractParams, ExtractReturnType, Method, RPCRequestMessage, RPCResponseMessage } from "zksync-sso/client-auth-server";

export const useRequestsStore = defineStore("requests", () => {
  const { appMeta } = useAppMeta();
  const { onMessage, postMessage, disconnect } = useCommunicatorStore();

  const request = ref<RPCRequestMessage<Method> | undefined>();
  const hasRequests = computed(() => !!request.value);
  const requestChain = computed(() => {
    const chainId = request.value?.content.chainId;
    return supportedChains.find((chain) => chain.id === chainId);
  });
  const requestMethod = computed(() => request.value?.content.action.method);
  const requestParams = computed(() => request.value?.content.action.method);

  onMessage<RPCRequestMessage<Method>>((message: RPCRequestMessage<Method>) => "content" in message)
    .then(async (message: RPCRequestMessage<Method>) => {
      if (message.content.action.method === "eth_requestAccounts" && message.content.action.params && "metadata" in message.content.action.params) {
        const handshakeData = message.content.action.params as ExtractParams<"eth_requestAccounts", AuthServerRpcSchema>;
        appMeta.value = handshakeData.metadata;
      }
      request.value = message;
    });

  const { inProgress: responseInProgress, execute: respond, error: responseError } = useAsync(async (responder: () => RPCResponseMessage<ExtractReturnType<Method>>["content"] | Promise<RPCResponseMessage<ExtractReturnType<Method>>["content"]>) => {
    if (!request.value) throw new Error("No request to confirm");

    // TODO: is it ok to serialize BigInts here?
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    const serializeBigInts = (obj: any): any => {
      if (typeof obj === "bigint") {
        return obj.toString();
      } else if (Array.isArray(obj)) {
        return obj.map((item) => serializeBigInts(item));
      } else if (obj && typeof obj === "object") {
        /* eslint-disable  @typescript-eslint/no-explicit-any */
        return Object.entries(obj).reduce((acc: any, [key, value]) => {
          acc[key] = serializeBigInts(value);
          return acc;
        }, {});
      }
      return obj;
    };

    const message = {
      id: crypto.randomUUID(),
      requestId: request.value.id,
      content: await responder(),
    };

    postMessage(serializeBigInts(message));
    disconnect();
  });

  const deny = () => {
    disconnect();
  };

  return {
    request: computed(() => request.value),
    hasRequests,
    responseInProgress,
    responseError,
    requestChain,
    requestMethod,
    requestParams,
    respond,
    deny,
  };
});
