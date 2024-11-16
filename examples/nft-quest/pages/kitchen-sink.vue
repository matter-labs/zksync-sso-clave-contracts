<template>
  <div class="bg-neutral-50 dark:bg-black">
    <p>
      Those great big fluffy clouds. We'll paint <zk-link
        to="https://google.com"
        target="_blank"
      >
        one happy little tree
      </zk-link> right here. And just raise cain. It's beautiful - and we haven't even done anything to it yet. I really recommend you use odorless thinner or your spouse is gonna run you right out into the yard and you'll be working by yourself. This painting comes right out of your heart. Work on one thing at a time. Don't get carried away - we have plenty of time. You need the dark in order to show the light.
    </p>
    <zk-link
      to="https://google.com"
      target="_blank"
      type="primary"
    >
      Google Link
      <zk-icon
        icon="open_in_new"
        class="text-base leading-tight align-text-bottom ml-1"
      />
    </zk-link>
    <zk-link
      to="https://google.com"
      target="_blank"
      type="secondary"
    >
      Google Link
      <zk-icon
        icon="open_in_new"
        class="text-base leading-tight align-text-bottom ml-1"
      />
    </zk-link>
    <zk-link
      to="https://google.com"
      target="_blank"
      type="tertiary"
    >
      Google Link
      <zk-icon
        icon="open_in_new"
        class="text-base leading-tight align-text-bottom ml-1"
      />
    </zk-link>
    <zk-link
      to="https://google.com"
      target="_blank"
      type="ghost"
    >
      Google Link
      <zk-icon
        icon="open_in_new"
        class="text-base leading-tight align-text-bottom ml-1"
      />
    </zk-link>

    <div class="pb-12 p-4">
      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Switch
      </h2>
      <zk-switch
        id="isChecked"
        :is-checked="true"
        @on-switch="checkEmit"
      >
        A Switch
      </zk-switch>
      <zk-switch
        id="isChecked"
        disabled
        :is-checked="true"
        @on-switch="checkEmit"
      >
        A Disabled Switch
      </zk-switch>

      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Icon
      </h2>
      <zk-icon icon="open_in_new" />
      <zk-icon icon="folder_copy" />
      <zk-icon icon="function" />

      <KitchenSinkButtonsExample />

      <h3 class="text-xl text-bold mt-3 dark:text-white">
        Icon
      </h3>
      <h4 class="dark:text-white">
        Default (Ghost)
      </h4>
      <ZkButtonIcon icon="open_in_new" />
      <ZkButtonIcon
        icon="open_in_new"
        disabled
      />
      <h4 class="dark:text-white">
        Primary
      </h4>
      <ZkButtonIcon
        type="primary"
        icon="open_in_new"
      />
      <h4 class="dark:text-white">
        Secondary
      </h4>
      <ZkButtonIcon
        type="secondary"
        icon="open_in_new"
      />
      <h4 class="dark:text-white">
        Tertiary
      </h4>
      <ZkButtonIcon
        type="tertiary"
        icon="open_in_new"
      />
      <h4 class="dark:text-white">
        Ghost
      </h4>
      <ZkButtonIcon
        type="ghost"
        icon="open_in_new"
      />
      <h4 class="dark:text-white">
        Danger
      </h4>
      <ZkButtonIcon
        type="danger"
        icon="open_in_new"
      />

      <h3 class="test-xl text-bold mt-3 dark:text-white">
        Copy Button
      </h3>
      <ZkCopy content="Copied content" />

      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Dropdown
      </h2>

      <ZkDropdown
        :menu="dropdownMenu"
        @select="itemSelected"
      />

      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Dialog
      </h2>
      <ZkDialog title="Disconnect?">
        Disconnect your username@zksync.eth account?
        <template #submit>
          <ZkButton
            type="danger"
            class="w-full"
          >
            <template #prefix>
              <ZkIcon icon="logout" />
            </template>
            Disconnect
          </ZkButton>
        </template>
      </ZkDialog>

      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Tabs
      </h2>
      <ZkTabs
        :tabs="[
          { slot: 'tab1', label: 'Tab1', icon: 'shield' },
          { slot: 'tab2', label: 'Tab2', icon: 'settings_account_box' },
          { slot: 'tab3', label: 'Tab3', icon: 'sync_alt' },
        ]"
      >
        <template #tab1>
          I am content for Tab1
        </template>
        <template #tab2>
          I am content for Tab2
        </template>
        <template #tab3>
          I am content for Tab3
        </template>
      </ZkTabs>

      <KitchenSinkInputsExample />

      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Table
      </h2>
      <ZkTableBody>
        <ZkTableRow>
          <div>
            <img
              src="/demo/avatar-uniswap.png"
              alt="Thumbnail"
            >
          </div>
          <ZkTableCellData class="flex-auto">
            Something Something
            <template #sub>
              sub text underneath
            </template>
          </ZkTableCellData>
          <ZkTableCellData class="text-right">
            0.50
            <template #sub>
              $1,500.00
            </template>
          </ZkTableCellData>
        </ZkTableRow>
        <ZkTableRow>
          <div>
            <img
              src="/demo/frame-thumbnail.png"
              alt="Thumbnail"
            >
          </div>
          <ZkTableCellData class="flex-auto">
            Something Something
            <template #sub>
              sub text underneath
            </template>
          </ZkTableCellData>
          <ZkTableCellData class="text-right">
            0.50
            <template #sub>
              $1,500.00
            </template>
          </ZkTableCellData>
        </ZkTableRow>
        <ZkTableRow-link>
          <span>A link</span>
        </ZkTableRow-link>
        <ZkTableRow>
          <div>
            <img
              src="/demo/square-thumbnail.png"
              alt="Thumbnail"
            >
          </div>
          <ZkTableCellData class="flex-auto">
            Something Something
            <template #sub>
              sub text underneath
            </template>
          </ZkTableCellData>
          <ZkTableCellData class="text-right">
            0.50
            <template #sub>
              $1,500.00
            </template>
          </ZkTableCellData>
        </ZkTableRow>
      </ZkTableBody>

      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Panel
      </h2>
      <ZkPanelSection
        title="Ecosystem"
        :ui="{ footer: 'flex justify-center' }"
      >
        <template #header-side>
          <ZkButton type="secondary">
            View All
          </ZkButton>
        </template>
        <ZkTableBody>
          <ZkTableRow>
            <ZkTableCellData>
              <zk-icon-thumbnail :icon="'passkey'" />
            </ZkTableCellData>
            <ZkTableCellData class="flex-auto">
              Something Something
              <template #sub>
                sub text underneath
              </template>
            </ZkTableCellData>
            <ZkTableCellData class="text-right">
              0.50
              <template #sub>
                $1,500.00
              </template>
            </ZkTableCellData>
          </ZkTableRow>
          <ZkTableRow>
            <ZkTableCellData>
              <ZkIconThumbnail :icon="'account_balance_wallet'" />
            </ZkTableCellData>
            <ZkTableCellData class="flex-auto">
              Something Something
              <template #sub>
                sub text underneath
              </template>
            </ZkTableCellData>
            <ZkTableCellData class="text-right">
              0.50
              <template #sub>
                $1,500.00
              </template>
            </ZkTableCellData>
          </ZkTableRow>
          <ZkTableRow>
            <div>
              <img
                src="/demo/avatar-uniswap.png"
                alt="Thumbnail"
              >
            </div>
            <ZkTableCellData class="flex-auto">
              Something Something
              <template #sub>
                sub text underneath
              </template>
            </ZkTableCellData>
            <ZkTableCellData class="text-right">
              0.50
              <template #sub>
                $1,500.00
              </template>
            </ZkTableCellData>
          </ZkTableRow>
        </ZkTableBody>
        <template #footer>
          <ZkButton type="secondary">
            View All
          </ZkButton>
        </template>
      </ZkPanelSection>
      <br>
      <ZkPanelSection title="Card panel">
        <template #header-side>
          <ZkButtonIcon
            icon="settings"
            type="secondary"
          />
        </template>
        <ZkPanelCard>
          <div>
            <span class="text-[2em] text-neutral-500">$</span>
            <span class="text-[3em]">12,200</span>
            <span class="text-[2em] text-neutral-500">.25</span>
          </div>
          <p>Card content</p>
          <ZkButton
            class="mr-2"
            type="ghost"
          >
            <template #prefix>
              <ZkIcon icon="south_west" />
            </template>
            Deposit
          </ZkButton>
          <ZkButton
            class="mr-2"
            type="ghost"
          >
            <template #prefix>
              <ZkIcon icon="north_east" />
            </template>
            Withdraw
          </ZkButton>

          <ZkButton
            class="mr-2"
            type="ghost"
          >
            <template #prefix>
              <ZkIcon
                icon="switch_access_shortcut"
                ui="rotate-90"
              />
            </template>
            Bridge
          </ZkButton>
        </ZkPanelCard>
      </ZkPanelSection>
    </div>
  </div>
</template>

<script setup lang="ts">
const dropdownMenu = [
  {
    value: "option1",
    label: "Option 1",
  },
  {
    value: "option2",
    label: "Option 2",
  },
  {
    value: "option3",
    label: "Option 3",
  },
];

function itemSelected(value: string) {
  console.log("Selected", value);
}

function checkEmit(checked: boolean) {
  console.log("Checked", checked);
}
</script>
