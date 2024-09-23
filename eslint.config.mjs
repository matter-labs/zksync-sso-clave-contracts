import pluginJs from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["**/node_modules/", "**/dist/", "**/temp/", "**/tmp/", "**/abi/"] },
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  stylistic.configs.customize({
    indent: 2,
    quotes: "double",
    semi: true,
    arrowParens: "always",
    quoteProps: "as-needed",
    braceStyle: "1tbs",
  }),
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
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
];
