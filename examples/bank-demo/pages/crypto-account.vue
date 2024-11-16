<template>
  <div class="pb-24">
    <LayoutHeader>
      Home
    </LayoutHeader>
    <div class="flex gap-4 mb-4 text-xs sm:text-base">
      <AppNavButton href="/">Accounts</AppNavButton>
      <AppNavButton href="/cards">Cards</AppNavButton>
      <AppNavButton href="/crypto-account">Crypto Account</AppNavButton>
    </div>

    <div v-if="!appMeta.hasCompletedInitialTransfer" class="flex flex-col justify-center items-center mb-6">
      <div class="bg-green-500 text-neutral-700 dark:text-neutral-300 dark:bg-neutral-800 w-[2.75rem] h-[2.75rem] p-2 rounded-full text-center">
        <ZkIcon icon="check" :ui="'text-white !text-2xl'"/>
      </div>
      <p class="text-lg text-neutral-700">Crypto account created.</p>
    </div>

    <LayoutCard class="flex gap-8 items-center justify-between mb-8 !py-2 !px-4" >
        <span class="text-l font-bold">Crypto Account Address</span>
        <div>
          <a :href="`${explorerUrl}address/${appMeta.cryptoAccountAddress}`" target="_blank" class="italic text-blue-500">
            {{ appMeta.cryptoAccountAddress?.slice(0,5) + '...' + appMeta.cryptoAccountAddress?.slice(-3)  }}
          </a>
          <ZkCopy :content="appMeta.cryptoAccountAddress! as string" />
        </div>
    </LayoutCard>

    <OnRampCrypto v-if="!appMeta.hasCompletedInitialTransfer"/>

    <LayoutCard v-else class="mb-8">
      <div class="flex">
        <div class="grow mb-4">
          <p class="text-4xl font-bold">{{ (+formatEther(accountBalance)).toFixed(4) }} ETH</p>
          <p class="text-lg font-medium text-neutral-400">ZKsync</p>
        </div>
        <div>
          <TokenEth :height="3"/>
        </div>
      </div>
      <div class="flex gap-2">

        <ZkButton type="secondary">
          <template #prefix>
            <ZkIcon icon="add" />
          </template>
          Deposit
        </ZkButton>

        <ZkButton type="secondary">
          <template #prefix>
            <ZkIcon icon="arrow_forward" />
          </template>
          Send
        </ZkButton>

        <ZkButton type="secondary">
          <template #prefix>
            <ZkIcon icon="info" />
          </template>
          info
        </ZkButton>

        <ZkButtonIcon type="secondary" icon="more_horiz"/>
      </div>

      <p class="mt-4 text-neutral-500">Transactions</p>
      <!-- <div class="flex gap-2 mt-4">
        <ZkIconThumbnail icon="add" />
        <div class="grow">
          <p>Received from john.eth</p>
          <p class="text-sm text-neutral-600">Just now</p>
        </div>
        <div class="text-2xl font-light">
          + 5.00 USDC
        </div>
      </div> -->
      <div v-for="(item, index) in history.cryptoAccount" :key="index" class="flex gap-2 mt-4">
        <ZkIconThumbnail :icon="item.icon" />
        <div class="grow">
          <a :href="`${explorerUrl}tx/${item.transactionHash}`" target="_blank" class="hover:text-blue-500">
            <div class="flex items-center">
              {{ item.description }}
              <ZkIcon type="secondary" icon="open_in_new" class="!text-[1.25rem] flex items-center ml-1 mt-0.5"/>
            </div>
          </a>
          <p class="text-sm text-neutral-600">{{ item.time }}</p>
        </div>
        <div class="text-2xl font-light">
          {{ item.amount }}
        </div>
      </div>
    </LayoutCard>

    <!-- <h2 class="mb-4 font-semibold text-neutral-600" v-if="appMeta.hasCompletedInitialTransfer">Assets</h2> -->
    <!-- <LayoutCard class="flex gap-2 items-center mb-2 py-4">
      <TokenUsdc :height="48" />
      <div class="flex flex-col">
        <span>USDC</span>
        <span class="text-neutral-700 text-sm">ZKsync</span>
      </div>
      <span class="grow text-right">5 USDC</span>
    </LayoutCard> -->
    <!-- <LayoutCard class="flex gap-2 items-center mb-8 py-4" v-if="appMeta.hasCompletedInitialTransfer">
      <TokenEth :height="3" />
      <div class="flex flex-col">
        <span>ETH</span>
        <span class="text-neutral-700 text-sm">ZKsync</span>
      </div>
      <span class="grow text-right">1 ETH</span>
    </LayoutCard> -->

    <h2 v-if="appMeta.hasCompletedInitialTransfer" class="mb-4 font-semibold text-neutral-600">Applications</h2>

    <div v-if="appMeta.hasCompletedInitialTransfer">
      <div class="bg-primary-200 rounded-t-zk flex items-center justify-center gap-2 py-4">
        <img src="/aave-logo.png" class="rounded-lg h-[2rem]"  >
        <span class="text-white">AAVE</span>
      </div>
      <div class="bg-white rounded-b-zk pt-4 px-8 pb-8">
        <ZkTabs
          v-model="tabSlot"
          :tabs="[
            { slot: 'tab1', label: 'Assets to supply' },
            { slot: 'tab2', label: 'Your supplies' },
          ]"
        >
        <template #tab1>
          <div v-if="!isAaveSupplyClicked" class="flex gap-2">
            <TokenEth :height="3"/>
            <div class="grow flex justify-stretch">
              <div class="grow">
                <div>ETH</div>
                <div class="text-sm text-neutral-600">ZKsync</div>
              </div>
              <div class="grow">
                <div>0.97 %</div>
                <div class="text-sm text-neutral-600">APY</div>
              </div>
              <div class="grow">
                <div>YES</div>
                <div class="text-sm text-neutral-600">Can be collateral</div>
              </div>
            </div>
            <div class="flex gap-2">
              <ZkButton type="secondary" @click="isAaveSupplyClicked = true">Supply</ZkButton>
              <ZkButtonIcon type="secondary" icon="more_horiz"/>
            </div>
          </div>
          <div v-else class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <ZkButtonIcon type="ghost" icon="arrow_back" @click="isAaveSupplyClicked = false"/>
              <span>Supply ETH</span>
              <TokenEth :height="1.5"/>
            </div>
            <div class="flex flex-col justify-stretch py-8 pb-2">
              <div class="flex grow">
                <div class="grow text-neutral-700 text-sm font-bold">Amount</div>
                <div>Balance: {{ (+formatEther(accountBalance)).toFixed(4) }}</div>
              </div>
              <div class="relative">
                <input v-model="stakeAmount" class="w-full text-neutral-800 rounded-zk p-4 pb-8 mt-2 border border-neutral-800" type="text" placeholder="0.1">
                <div class="absolute bottom-1 left-4 text-neutral-600">£{{(stakeAmount * cart.priceOfEth).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}}</div>
              </div>
            </div>
            <p class="text-sm font-bold text-neutral-700">Transaction overview</p>
            <div class="rounded-zk bg-neutral-100 p-4 text-neutral-700">
              <div class="flex">
                <span class="grow">Supply APY</span>
                <span class="text-right">0.97%</span>
              </div>
              <div class="flex pt-2">
                <span class="grow">Collateralization</span>
                <span class="text-right">Enabled</span>
              </div>
            </div>
            <div class="flex items-center py-1">
              <ZkIcon icon="local_gas_station"/> £0.03
            </div>
            <div class="flex justify-center">
              <ZkButton type="primary" class="w-full py-0 text-l" :disabled="isLoading" :ui="{base: 'py-0'}" @click="onClickSupplyEth">
                <div class="flex gap-2 items-center">
                  <span class="py-3">Supply ETH</span>
                  <CommonSpinner v-if="isLoading" class="h-6 mt-1"/>
                </div>
              </ZkButton>
            </div>
            <div v-if="errorMessage" class="flex items-center justify-center py-1 text-red-500">
              {{ errorMessage }}
            </div>
          </div>
        </template>
        <template #tab2>
          <div v-if="appMeta.hasCompletedAaveStake">
            <div class="flex gap-4 mb-2">
            <div class="flex grow gap-4 items-center">
              <div class="bg-green-500 text-neutral-700 dark:text-neutral-300 dark:bg-neutral-800 w-[2.75rem] h-[2.75rem] p-2 rounded-full text-center">
                <ZkIcon icon="check" :ui="'text-white !text-2xl'"/>
              </div>
              <h3 class="text-3xl font-bold">All done!</h3>
            </div>
            <div class="text-center">
              <p class="text-lg text-neutral-700">You supplied {{stakeAmount}} ETH</p>
              <a :href="`${explorerUrl}tx/${history.cryptoAccount[0]?.transactionHash}`" target="_blank" class="text-neutral-700 underline">Review tx details</a>
            </div>
          </div>
          <div class="rounded-zk bg-neutral-100 p-4 mt-4">
            <div class="mb-2 flex items-center">
              <div class="grow flex items-center">
                <TokenEth :height="3"/>
                <div class="ml-2">
                  <div>ETH</div>
                  <div class="text-xs text-neutral-600">Asset</div>
                </div>
              </div>
              <ZkButton type="secondary" class="h-8 mr-2">Supply</ZkButton>
              <ZkButton type="secondary" class="h-8">Withdraw</ZkButton>
            </div>
            <hr class="border-neutral-200">
            <div class="flex mt-2 gap-4">
              <div>
                <span>{{history.cryptoAccount.slice(0,-1).reduce((acc, value) => acc + value.valueEth, 0).toLocaleString(undefined, {maximumSignificantDigits: 4})}} ETH</span>
                <span class="ml-1 text-xs text-neutral-600">£{{(history.cryptoAccount.slice(0,-1).reduce((acc, value) => acc + value.valueEth, 0) * cart.priceOfEth).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}}</span>
                <div class="text-sm text-neutral-600">Balance</div>
              </div>
              <div>
                <span>0.97%</span>
                <div class="text-sm text-neutral-600">APY</div>
              </div>
              <div>
                <span>Yes</span>
                <div class="text-sm text-neutral-600">Collateral</div>
              </div>
            </div>
          </div>
          </div>
          <div v-else>No assets supplied.</div>
        </template>
      </ZkTabs>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { createPublicClient, formatEther, http, parseEther, TransactionExecutionError, type Address, type Chain } from "viem";
import { createZksyncPasskeyClient } from "zksync-sso/client/passkey";
import OnRampCrypto from "~/components/app/OnRampCrypto.vue";

const { appMeta, userDisplay, userId, contracts, aaveAddress, explorerUrl } = useAppMeta();
const history = useHistory();
const accountBalance = ref(0n);
const isAaveSupplyClicked = ref(false);
const cart = useCart();
const stakeAmount = ref(0.1);
const tabSlot = ref<string | number>("tab1");
const isLoading = ref(false);
const errorMessage = ref("");

const config = useRuntimeConfig();

// onMounted(() => {
//   const getBalance = async () => {
//     accountBalance.value = await publicClient.getBalance({
//       address: appMeta.value.cryptoAccountAddress! as Address,
//     });
//   };
//   const { resume } = useTimeoutPoll(getBalance, 1000);

//   resume();
// });

const publicClient = createPublicClient({
  chain: config.public.network as Chain,
  transport: http(),
});

if (appMeta.value.cryptoAccountAddress) {
  accountBalance.value = await publicClient.getBalance({
    address: appMeta.value.cryptoAccountAddress! as Address,
  });
}

watch(appMeta, async (newValue) => {
  if (!newValue.cryptoAccountAddress) { return; }

  console.log("Updating balance...");
  accountBalance.value = await publicClient.getBalance({
    address: newValue.cryptoAccountAddress! as Address,
  });
});

const onClickSupplyEth = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    await supplyEthToAave();
  } catch (error) {
    if (error instanceof TransactionExecutionError) {
      if (error.details.includes("function_selector = 0xe7931438")) {
        errorMessage.value = "Insufficient Funds";
      } else {
        errorMessage.value = error.details;
      }
    } else {
      errorMessage.value = "Error occurred, please check console logs for more information.";
      console.error(error);
    }
  } finally {
    isLoading.value = false;
  }
};

const supplyEthToAave = async () => {
  // Send some ETH to the AAVE address
  const passkeyClient = createZksyncPasskeyClient({
    address: appMeta.value.cryptoAccountAddress! as Address,
    credentialPublicKey: new Uint8Array(JSON.parse(appMeta.value.credentialPublicKey!)),
    userDisplayName: userDisplay,
    userName: userId,
    contracts,
    chain: config.public.network as Chain,
    transport: http(),
  });

  console.log(`Sending ${stakeAmount.value} ETH to AAVE Address`, aaveAddress);
  const transactionReceipt = await passkeyClient.sendTransaction({
    to: aaveAddress as Address,
    value: parseEther(stakeAmount.value.toString()),
  });

  // Update that Aave Staking is completed
  history.value.cryptoAccount.unshift({
    description: "Staked on AAVE",
    time: "Just now",
    icon: "savings",
    amount: `- ${stakeAmount.value} ETH`,
    transactionHash: transactionReceipt,
    valueEth: +stakeAmount.value,
  });
  appMeta.value = {
    ...appMeta.value,
    hasCompletedAaveStake: true,
  };
  isAaveSupplyClicked.value = false;
  tabSlot.value = "tab2";
};
</script>
