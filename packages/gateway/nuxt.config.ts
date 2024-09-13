// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-07-08",
  devtools: { enabled: true },
  modules: ["@nuxt/eslint", "@pinia/nuxt", "@nuxtjs/tailwindcss", "@nuxtjs/google-fonts"],

  ssr: false,
  devServer: {
    port: 3002,
  },
  css: ["@/assets/css/tailwind.css", "@/assets/css/style.scss", "web3-avatar-vue/dist/style.css"],
  googleFonts: {
    families: {
      Inter: [400, 500, 600, 700],
    },
  },
  eslint: {
    config: {
      stylistic: {
        semi: true,
        quotes: "double",
        arrowParens: true,
        quoteProps: "as-needed",
        braceStyle: "1tbs",
      },
    },
  },
});
