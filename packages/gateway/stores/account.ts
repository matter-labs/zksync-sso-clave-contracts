import { useStorage, StorageSerializers } from "@vueuse/core";
import { type Address } from "viem";

type SmartAccount = {
  username: string;
  address: Address;
};

export const useAccountStore = defineStore("account", () => {
  const accountData = useStorage<SmartAccount | null>("account", null, undefined, {
    serializer: StorageSerializers.object,
  });
  const address = computed(() => accountData.value?.address || null);
  const isLoggedIn = computed(() => !!address.value);
  const login = (data: SmartAccount) => {
    console.log("login", data);
    accountData.value = data;
  };
  const logout = () => {
    accountData.value = null;
  };

  const { subscribe: subscribeOnAddressChange, notify: notifyOnAccountChange } = useObservable<Address | null>();
  watch(address, (newAddress) => {
    notifyOnAccountChange(newAddress);
  });

  return {
    address,
    isLoggedIn,
    subscribeOnAddressChange,
    login,
    logout,
  };
});
