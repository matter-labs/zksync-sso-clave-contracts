// @ts-check
import simpleImportSort from "eslint-plugin-simple-import-sort";

import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  {
    rules: {
      "no-console": "warn",
      semi: ["error", "always"], // Require semicolons
      quotes: ["error", "double"], // Require double quotes
      "vue/multi-word-component-names": "off", // Allow multi-word component names
      "vue/require-default-prop": "off", // Allow props without default values
    },
  },
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "sort-imports": "off",
    },
  },
).prepend({
  ignores: ["**/playwright-report"],
});
