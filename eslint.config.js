const { FlatCompat } = require("@eslint/eslintrc");
const nxEslintPlugin = require("@nx/eslint-plugin");
const stylistic = require("@stylistic/eslint-plugin");

const js = require("@eslint/js");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  { ignores: ["node_modules", "dist"] },
  { plugins: { "@nx": nxEslintPlugin, "@stylistic": stylistic } },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: "*",
              onlyDependOnLibsWithTags: ["*"],
            },
          ],
        },
      ],
    },
  },
  ...compat.config({ extends: ["plugin:@nx/typescript"] }).map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      ...config.rules,
    },
  })),
  ...compat.config({ extends: ["plugin:@nx/javascript"] }).map((config) => ({
    ...config,
    files: ["**/*.js", "**/*.jsx"],
    rules: {
      ...config.rules,
    },
  })),
];
