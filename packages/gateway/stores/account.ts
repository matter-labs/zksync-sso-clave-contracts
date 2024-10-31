import { StorageSerializers, useStorage } from "@vueuse/core";
import { type Address, type Hash, toBytes } from "viem";

type SmartAccount = {
  username: string;
  address: Address;
  passkey: Hash;
};

export const useAccountStore = defineStore("account", () => {
  const accountData = useStorage<SmartAccount | null>("account", null, undefined, {
    serializer: StorageSerializers.object,
  });
  const address = computed(() => accountData.value?.address || null);
  const passkey = computed(() => accountData.value?.passkey ? toBytes(accountData.value?.passkey) : null);
  const username = computed(() => accountData.value?.username || null);
  const isLoggedIn = computed(() => !!address.value);
  const login = (data: SmartAccount) => {
    accountData.value = data;
  };
  const logout = () => {
    accountData.value = null;
  };

  const { subscribe: subscribeOnAccountChange, notify: notifyOnAccountChange } = useObservable<Address | null>();
  watch(address, (newAddress) => {
    notifyOnAccountChange(newAddress);
  });

  return {
    address,
    passkey,
    username,
    isLoggedIn,
    subscribeOnAccountChange,
    login,
    logout,
  };
});
