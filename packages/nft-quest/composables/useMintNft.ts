import { estimateGas, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { type Address, encodeFunctionData } from "viem";
import { getGeneralPaymasterInput } from "viem/zksync";

import { supportedChains } from "~/stores/connector";

export const useMintNft = async (_address: MaybeRef<Address>) => {
  const address = toRef(_address);

  return await useAsyncData("mintZeek", async () => {
    const runtimeConfig = useRuntimeConfig();
    const { account, wagmiConfig } = storeToRefs(useConnectorStore());

    const mintingForAddress = address.value || account.value.address;

    const data = encodeFunctionData({
      abi: nftAbi,
      functionName: "mint",
      args: [mintingForAddress],
    });

    const estimatedGas = await estimateGas(wagmiConfig.value, {
      account: account.value.address,
      to: runtimeConfig.public.contracts.nft as Address,
      chainId: supportedChains[0].id,
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

    if (!transactionHash) throw Error("write failed");

    const waitForReceipt = async () => {
      try {
        const transactionReceipt = await waitForTransactionReceipt(wagmiConfig.value, { hash: transactionHash });
        return transactionReceipt;
      } catch (error) {
        if (error instanceof Error && (error.message.includes("The Transaction may not be processed on a block yet") || error.message.includes("Cannot convert null to a BigInt"))) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return await waitForReceipt();
        }
        throw error;
      }
    };

    const trxnReceipt = await waitForReceipt();

    return trxnReceipt;
  }, {
    server: false,
    immediate: false,
  });
};
