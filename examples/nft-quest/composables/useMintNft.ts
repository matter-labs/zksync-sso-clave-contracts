import { waitForTransactionReceipt, writeContract } from "@wagmi/core";
import type { Address } from "viem";
import { getGeneralPaymasterInput } from "viem/zksync";

export const useMintNft = async (_address: MaybeRef<Address>) => {
  const address = toRef(_address);

  return await useAsyncData("mintZeek", async () => {
    const runtimeConfig = useRuntimeConfig();
    const { wagmiConfig } = storeToRefs(useConnectorStore());

    const mintingForAddress = address.value;
    const transactionHash = await writeContract(wagmiConfig.value, {
      address: runtimeConfig.public.contracts.nft as Address,
      abi: nftAbi,
      functionName: "mint",
      args: [mintingForAddress],
      paymaster: runtimeConfig.public.contracts.paymaster as Address,
      paymasterInput: getGeneralPaymasterInput({ innerInput: "0x" }),
    });

    const transactionReceipt = await waitForTransactionReceipt(wagmiConfig.value, { hash: transactionHash });
    if (transactionReceipt.status === "reverted") {
      throw new Error("Transaction reverted");
    }

    return transactionReceipt;
  }, {
    server: false,
    immediate: false,
  });
};
