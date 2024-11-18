<template>
  <div class="bg-khaki dark:bg-black">
    <layout-header>
      Settings
      <template #aside>
        <ZkButtonIcon
          type="secondary"
          icon="dashboard_customize"
        />
      </template>
    </layout-header>
    <LayoutCard>
      This is a card
    </LayoutCard>
    <layout-section
      title="Passkeys"
      sub="You must have at least one Passkey, but up to 10 are possible."
    >
      <template #aside>
        <ZkButton type="secondary">
          <template #prefix>
            <ZkIcon icon="add" />
          </template>
          Add
        </ZkButton>
      </template>
      <p>
        Now that there is the Tec-9, a crappy spray gun from South Miami. This
        gun is advertised as the most popular gun in American crime. Do you
        <zk-link to="https://google.com" target="_blank">Google</zk-link>
        believe that shit? It actually says that in the little book that comes
        with it: the most popular gun in American crime. Like they're actually
        proud of that shit.
      </p>
      <zk-link to="https://google.com" target="_blank" type="primary"
        >Google Link
        <zk-icon
          icon="open_in_new"
          class="text-base leading-tight align-text-bottom ml-1"
        />
      </zk-link>
      <zk-link to="https://google.com" target="_blank" type="secondary"
        >Google Link
        <zk-icon
          icon="open_in_new"
          class="text-base leading-tight align-text-bottom ml-1"
        />
      </zk-link>
      <zk-link to="https://google.com" target="_blank" type="ghost"
        >Google Link
        <zk-icon
          icon="open_in_new"
          class="text-base leading-tight align-text-bottom ml-1"
        />
      </zk-link>
    </layout-section>

    <div class="pb-12 p-4">
      <h2 class="text-2xl text-bold mt-4 dark:text-white">Switch</h2>
      <zk-switch id="isChecked" :is-checked="true" @on-switch="checkEmit"
        >A Switch</zk-switch
      >
      <zk-switch
        id="isChecked"
        disabled
        :is-checked="true"
        @on-switch="checkEmit"
        >A Disabled Switch</zk-switch
      >

      <h2 class="text-2xl text-bold mt-4 dark:text-white">Icon</h2>
      <ZkIcon icon="open_in_new" />
      <ZkIcon icon="folder_copy" />
      <ZkIcon icon="function" />

      <h2 class="text-2xl text-bold mt-4 dark:text-white">Buttons</h2>

      <h3 class="text-xl text-bold mt-3 dark:text-white">Primary</h3>
      <ZkButton>Primary Button</ZkButton>
      <ZkButton disabled>Primary Disabled</ZkButton>

      <h3 class="text-xl text-bold mt-3 dark:text-white">Secondary</h3>
      <ZkButton type="secondary">Secondary Button</ZkButton>
      <ZkButton type="secondary" disabled>Secondary Disabled</ZkButton>

      <h3 class="text-xl text-bold mt-3 dark:text-white">Danger</h3>
      <ZkButton type="danger">Danger Button</ZkButton>
      <ZkButton type="danger" disabled>Danger Disabled</ZkButton>

      <h3 class="text-xl text-bold mt-3 dark:text-white">Ghost</h3>
      <ZkButton type="ghost">Ghost Button</ZkButton>
      <ZkButton type="ghost" disabled>Ghost Disabled</ZkButton>

      <h3 class="text-xl text-bold mt-3 dark:text-white">With icon</h3>
      <ZkButton type="primary">
        <template #prefix>
          <ZkIcon icon="switch_access_shortcut" ui="rotate-90" />
        </template>
        Button with icon
      </ZkButton>
      <ZkButton type="ghost">
        <template #prefix>
          <ZkIcon icon="open_in_new" />
        </template>
        Button with icon
      </ZkButton>

      <h3 class="text-xl text-bold mt-3 dark:text-white">Button Icon</h3>
      <h4 class="dark:text-white">Default (Ghost)</h4>
      <ZkButtonIcon icon="open_in_new"/>
      <ZkButtonIcon icon="open_in_new" disabled/>
      <h4 class="dark:text-white">Primary</h4>
      <ZkButtonIcon type="primary" icon="open_in_new"/>
      <h4 class="dark:text-white">Secondary</h4>
      <ZkButtonIcon type="secondary" icon="open_in_new"/>
      <h4 class="dark:text-white">Ghost</h4>
      <ZkButtonIcon type="ghost" icon="open_in_new"/>
      <h4 class="dark:text-white">Danger</h4>
      <ZkButtonIcon type="danger" icon="open_in_new"/>

      <h3 class="test-xl text-bold mt-3 dark:text-white">Copy Button</h3>
      <zk-copy content="Copied content" />

      <h2 class="text-2xl text-bold mt-4 dark:text-white">Dropdown</h2>

      <ZkDropdown :menu="dropdownMenu" @select="itemSelected"/>
      <ZkDropdown :menu="dropdownMenu" align="start" type="ghost">
          <div class="flex items-center gap-1 text-neutral-800">
            <TokenUsdc height="24"/> <span>USDC</span>
          </div>
        </ZkDropdown>

      <h2 class="text-2xl text-bold mt-4 dark:text-white">Dialog</h2>
      <ZkDialog title="Disconnect?">
        Disconnect your username@zksync.eth account?
        <template #submit>
          <ZkButton type="danger" class="w-full">
            <template #prefix>
              <ZkIcon icon="logout" />
            </template>
            Disconnect
          </ZkButton>
        </template>
      </ZkDialog>

      <h2 class="text-2xl text-bold mt-4 dark:text-white">Tabs</h2>
      <ZkTabs
        :tabs="[
          { slot: 'tab1', label: 'Tab1', icon: 'shield' },
          { slot: 'tab2', label: 'Tab2', icon: 'settings_account_box' },
          { slot: 'tab3', label: 'Tab3', icon: 'sync_alt' },
        ]"
      >
        <template #tab1> I am content for Tab1 </template>
        <template #tab2> I am content for Tab2 </template>
        <template #tab3> I am content for Tab3 </template>
      </ZkTabs>

      <h2 class="text-2xl text-bold mt-4 dark:text-white">Input</h2>
      <ZkInput placeholder="Label" />
      <br >
      <ZkInput placeholder="Disabled" disabled />
      <br >
      <ZkInput placeholder="Label" post-label="@zksync.eth" />
      <br >
      <ZkInput placeholder="Error" state="error" :messages="errorMessages" />
      <br >
      <ZkInput placeholder="Error" state="error" post-label="@zksync.eth" />

      <h2 class="text-2xl text-bold mt-4 dark:text-white">Table</h2>
      <ZkTableBody>
        <ZkTableRow>
          <div><img src="/avatar-uniswap.png" alt="Thumbnail" ></div>
          <ZkTableCellData class="flex-auto">
            Something Something
            <template #sub>sub text underneath</template>
          </ZkTableCellData>
          <ZkTableCellData class="text-right">
            0.50
            <template #sub>$1,500.00</template>
          </ZkTableCellData>
        </ZkTableRow>
        <ZkTableRow>
          <div><img src="/frame-thumbnail.png" alt="Thumbnail" ></div>
          <ZkTableCellData class="flex-auto">
            Something Something
            <template #sub>sub text underneath</template>
          </ZkTableCellData>
          <ZkTableCellData class="text-right">
            0.50
            <template #sub>$1,500.00</template>
          </ZkTableCellData>
        </ZkTableRow>
        <ZkTableRowLink>
          <span>A link</span>
        </ZkTableRowLink>
        <ZkTableRow>
          <div><img src="/square-thumbnail.png" alt="Thumbnail" ></div>
          <ZkTableCellData class="flex-auto">
            Something Something
            <template #sub>sub text underneath</template>
          </ZkTableCellData>
          <ZkTableCellData class="text-right">
            0.50
            <template #sub>$1,500.00</template>
          </ZkTableCellData>
        </ZkTableRow>
      </ZkTableBody>

      <h2 class="text-2xl text-bold mt-4 dark:text-white">Panel</h2>
      <ZkPanelSection
        title="Ecosystem"
        :ui="{ footer: 'flex justify-center' }"
      >
        <template #header-side>
          <ZkButton type="secondary">View All</ZkButton>
        </template>
        <ZkTableBody>
          <ZkTableRow>
            <ZkTableCellData>
              <ZkIconThumbnail :icon="'passkey'" />
            </ZkTableCellData>
            <ZkTableCellData class="flex-auto">
              Something Something
              <template #sub>sub text underneath</template>
            </ZkTableCellData>
            <ZkTableCellData class="text-right">
              0.50
              <template #sub>$1,500.00</template>
            </ZkTableCellData>
          </ZkTableRow>
          <ZkTableRow>
            <ZkTableCellData
              ><ZkIconThumbnail :icon="'account_balance_wallet'"
            /></ZkTableCellData>
            <ZkTableCellData class="flex-auto">
              Something Something
              <template #sub>sub text underneath</template>
            </ZkTableCellData>
            <ZkTableCellData class="text-right">
              0.50
              <template #sub>$1,500.00</template>
            </ZkTableCellData>
          </ZkTableRow>
          <ZkTableRow>
            <div><img src="/avatar-uniswap.png" alt="Thumbnail" ></div>
            <ZkTableCellData class="flex-auto">
              Something Something
              <template #sub>sub text underneath</template>
            </ZkTableCellData>
            <ZkTableCellData class="text-right">
              0.50
              <template #sub>$1,500.00</template>
            </ZkTableCellData>
          </ZkTableRow>
        </ZkTableBody>
        <template #footer>
          <ZkButton type="secondary">View All</ZkButton>
        </template>
      </ZkPanelSection>
      <br >
      <ZkPanelSection title="Card panel">
        <template #header-side>
          <ZkButtonIcon icon="settings" type="secondary"/>
        </template>
        <ZkPanelCard>
          <div>
            <span class="text-[2em] text-neutral-500">$</span>
            <span class="text-[3em]">12,200</span>
            <span class="text-[2em] text-neutral-500">.25</span>
          </div>
          <p>Card content</p>
          <ZkButton class="mr-2" type="ghost">
            <template #prefix>
              <ZkIcon icon="south_west" />
            </template>
            Deposit
          </ZkButton>
          <ZkButton class="mr-2" type="ghost">
            <template #prefix>
              <ZkIcon icon="north_east" />
            </template>
            Withdraw
          </ZkButton>

          <ZkButton class="mr-2" type="ghost">
            <template #prefix>
              <ZkIcon icon="switch_access_shortcut" ui="rotate-90" />
            </template>
            Bridge
          </ZkButton>
        </ZkPanelCard>
      </ZkPanelSection>
    </div>
  </div>
</template>

<script setup lang="ts">
const errorMessages = [
  "Long error text that should be as long as the input and then wrap around.",
  "Secondary short text error message.",
];

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
