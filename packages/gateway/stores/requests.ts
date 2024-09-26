import type { ExtractParams, ExtractReturnType, GatewayRpcSchema, Method, RPCRequestMessage, RPCResponseMessage } from "zksync-account/client-gateway";

export const useRequestsStore = defineStore("requests", () => {
  const { appMeta } = useAppMeta();

  const request = ref<RPCRequestMessage<Method> | undefined>();
  const hasRequests = computed(() => !!request.value);
  const requestChain = computed(() => {
    const chainId = request.value?.content.chainId;
    return supportedChains.find((chain) => chain.id === chainId);
  });
  const requestMethod = computed(() => request.value?.content.action.method);
  const requestParams = computed(() => request.value?.content.action.method);

  communicator.onMessage<RPCRequestMessage<Method>>((message) => "content" in message)
    .then(async (message) => {
      if (message.content.action.method === "eth_requestAccounts" && "metadata" in message.content.action) {
        const handshakeData = message.content.action.params as ExtractParams<"eth_requestAccounts", GatewayRpcSchema>;
        appMeta.value = handshakeData.metadata;
      }
      request.value = message;
    });

  const { inProgress: responseInProgress, execute: respond } = useAsync(async (responder: () => RPCResponseMessage<ExtractReturnType<Method>>["content"] | Promise<RPCResponseMessage<ExtractReturnType<Method>>["content"]>) => {
    if (!request.value) throw new Error("No request to confirm");

    communicator.postMessage({
      id: crypto.randomUUID(),
      requestId: request.value.id,
      content: await responder(),
    });
    communicator.disconnect();
  });

  const deny = () => {
    communicator.disconnect();
  };

  return {
    request: computed(() => request.value),
    hasRequests,
    responseInProgress,
    requestChain,
    requestMethod,
    requestParams,
    respond,
    deny,
  };
});
