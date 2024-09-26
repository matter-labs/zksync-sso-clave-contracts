import { useStorage, StorageSerializers } from "@vueuse/core";
import { toBytes, type Address, type Hash } from "viem";

type SmartAccount = {
  username: string;
  address: Address;
  passkey: Hash;
  sessionKey: Hash; // TODO: This one is temporary, should be removed once sessions work properly
};

export const useAccountStore = defineStore("account", () => {
  const accountData = useStorage<SmartAccount | null>("account", null, undefined, {
    serializer: StorageSerializers.object,
  });
  const address = computed(() => accountData.value?.address || null);
  const passkey = computed(() => accountData.value?.passkey ? toBytes(accountData.value?.passkey) : null);
  const sessionKey = computed(() => accountData.value?.sessionKey ? accountData.value?.sessionKey : null);
  const username = computed(() => accountData.value?.username || null);
  const isLoggedIn = computed(() => !!address.value);
  const login = (data: SmartAccount) => {
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
    passkey,
    sessionKey,
    username,
    isLoggedIn,
    subscribeOnAddressChange,
    login,
    logout,
  };
});
