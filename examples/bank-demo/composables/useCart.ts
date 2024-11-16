import { useStorage } from "@vueuse/core";

export interface CartData {
  amount: number;
  priceOfEth: number;
}

export const useCart = () => {
  const cartData = useStorage<CartData>("cart-data", {
    amount: 0,
    priceOfEth: 1786.79
  });

  return cartData;
};
