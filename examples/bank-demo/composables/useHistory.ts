import { useStorage } from "@vueuse/core";



export interface HistoryData {
  mainAccount: Array<{ icon: string; description: string; amount: string; time: string; value: number; }>;
  cryptoAccount: Array<{ icon: string; description: string; amount: string; time: string; transactionHash: string; valueEth: number; }>;
}

export const useHistory = () => {
  const history = useStorage<HistoryData>("history", {
    mainAccount: [
      {description: "OBA topup from J Doe", amount: "+ £2,000.00", time: "4 Oct, 13:32 - OBAGNSGT3OXBB4433", icon: "add", value: 2000},
    ],
    cryptoAccount: []
  });

  return history;
};
