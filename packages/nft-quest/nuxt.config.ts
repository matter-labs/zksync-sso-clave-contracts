import { defineNuxtConfig } from "nuxt/config";
import { zksyncInMemoryNode } from "viem/chains";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    "@nuxt/eslint",
    "@nuxtjs/color-mode",
    "@nuxtjs/google-fonts",
    "@nuxtjs/tailwindcss",
    "@pinia/nuxt",
    "@vueuse/nuxt",
    "radix-vue/nuxt",
    "@nuxtjs/color-mode",
    "@nuxtjs/seo",
    "@vueuse/motion/nuxt",
  ],
  colorMode: {
    preference: "dark",
  },
  devtools: { enabled: false },
  app: {
    head: {
      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "icon", type: "image/png", href: "/favicon_48x48.png", sizes: "48x48" },
      ],
      bodyAttrs: {
        class: "dark-mode",
      },
    },
  },
  css: ["@/assets/style.scss"],
  site: {
    url: "https://nft-quest.zksync.io",
    name: "NFT Quest",
    description: "Mint your own ZKsync NFT gas-free",
    defaultLocale: "en",
  },
  compatibilityDate: "2024-04-03",
  // ssr: false,
  eslint: {
    config: {
      stylistic: {
        indent: 2,
        semi: true,
        quotes: "double",
        arrowParens: true,
        quoteProps: "as-needed",
        braceStyle: "1tbs",
      },
    },
  },
  googleFonts: {
    families: {
      Inter: [200, 300, 400, 500, 600, 700],
    },
  },
  runtimeConfig: {
    public: {
      chain: zksyncInMemoryNode,
      contracts: {
        nft: "0x111C3E89Ce80e62EE88318C2804920D4c96f92bb",
        paymaster: "0x4B5DF730c2e6b28E17013A1485E5d9BC41Efe021",
      },
      explorerURL: "http://localhost:3010",
    },
  },
});
