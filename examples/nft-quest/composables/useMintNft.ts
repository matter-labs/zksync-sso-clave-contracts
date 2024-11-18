import { getConnectorClient, waitForTransactionReceipt } from "@wagmi/core";
import { type Address, parseEther } from "viem";
import { getGeneralPaymasterInput } from "viem/zksync";
import type { ZksyncAccountSessionClient } from "zksync-sso/client";

export const useMintNft = async (_address: MaybeRef<Address>) => {
  const address = toRef(_address);

  return await useAsyncData("mintZeek", async () => {
    const runtimeConfig = useRuntimeConfig();
    const { wagmiConfig } = useConnectorStore();

    const mintingForAddress = address.value;
    const client = (await getConnectorClient(wagmiConfig)) as unknown as ZksyncAccountSessionClient;
    console.log("client.sendTransaction", client.sendTransaction);
    const transactionHash = await client.writeContract({
      address: runtimeConfig.public.contracts.nft as Address,
      abi: nftAbi,
      functionName: "mint",
      args: [mintingForAddress],
      paymaster: runtimeConfig.public.contracts.paymaster as Address,
      paymasterInput: getGeneralPaymasterInput({ innerInput: "0x" }),
      value: parseEther("0.0001"),
    });

    const transactionReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: transactionHash });
    if (transactionReceipt.status === "reverted") {
      throw new Error("Transaction reverted");
    }

    return transactionReceipt;
  }, {
    server: false,
    immediate: false,
  });
};
