import { estimateGas, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { type Address, encodeFunctionData } from "viem";
import { getGeneralPaymasterInput } from "viem/zksync";

export const useMintNft = async (_address: MaybeRef<Address>) => {
  const address = toRef(_address);

  return await useAsyncData("mintZeek", async () => {
    const runtimeConfig = useRuntimeConfig();
    const { wagmiConfig } = storeToRefs(useConnectorStore());

    const mintingForAddress = address.value;
    const data = encodeFunctionData({
      abi: nftAbi,
      functionName: "mint",
      args: [address.value],
    });

    const estimatedGas = await estimateGas(wagmiConfig.value, {
      to: runtimeConfig.public.contracts.nft as Address,
      chainId: runtimeConfig.public.chain.id,
      data,
    });

    const transactionHash = await writeContract(wagmiConfig.value, {
      address: runtimeConfig.public.contracts.nft as Address,
      abi: nftAbi,
      functionName: "mint",
      args: [mintingForAddress],
      gas: estimatedGas + (estimatedGas / 100n * 25n), // gas may be underestimated
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
