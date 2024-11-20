import { FetchError } from "ofetch";
import { type Address, erc20Abi } from "viem";

export const useTokenUtilities = (_chainId: MaybeRef<SupportedChainId>) => {
  const chainId = toRef(_chainId);
  const { getPublicClient } = useClientStore();

  const fetchTokenFromBlockExplorerApi = async (tokenAddress: Address): Promise<Token> => {
    const { result } = await $fetch<{
      result: {
        tokenName: string;
        symbol: string;
        tokenDecimal: string;
        tokenPriceUSD: string;
        iconURL: string;
      }[];
    }>(`${blockExplorerApiByChain[chainId.value]}?module=token&action=tokeninfo&contractaddress=${tokenAddress}`);
    const tokenInfo = result[0];
    if (!tokenInfo) {
      const error = new FetchError("Token not found");
      error.statusCode = 404;
      throw error;
    }
    return {
      address: tokenAddress,
      name: tokenInfo.tokenName,
      symbol: tokenInfo.symbol,
      decimals: parseInt(tokenInfo.tokenDecimal),
      price: parseFloat(tokenInfo.tokenPriceUSD),
      iconUrl: tokenInfo.iconURL,
    };
  };
  const fetchTokenInfoFromRpc = async (tokenAddress: Address): Promise<Token> => {
    const client = getPublicClient({ chainId: chainId.value });
    const [symbol, name, decimals] = await Promise.all([
      client.readContract({
        abi: erc20Abi,
        functionName: "symbol",
        address: tokenAddress,
      }),
      client.readContract({
        abi: erc20Abi,
        functionName: "name",
        address: tokenAddress,
      }),
      client.readContract({
        abi: erc20Abi,
        functionName: "decimals",
        address: tokenAddress,
      }),
    ]);
    return {
      address: tokenAddress,
      name: name || "Unknown",
      symbol: symbol || "unknown",
      decimals: decimals,
      price: undefined,
      iconUrl: undefined,
    };
  };
  const fetchTokenInfo = async (tokenAddress: Address): Promise<Token> => {
    const token = (await fetchTokenFromBlockExplorerApi(tokenAddress).catch((err) => {
      console.error(`Failed to fetch token info from block explorer API: ${err}`);
    })) || (await fetchTokenInfoFromRpc(tokenAddress));
    return token;
  };

  return {
    fetchTokenInfo,
    fetchTokenInfoFromRpc,
    fetchTokenFromBlockExplorerApi,
  };
};
