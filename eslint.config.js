import { Linter } from "eslint";

/** @type {Linter.FlatConfig[]} */
const config = [
  {
    languageOptions: {
      parser: "@typescript-eslint/parser",
      ecmaVersion: 2020,
      sourceType: "module",
    },
    env: {
      browser: true,
      node: true,
      es6: true,
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
      prettier: require("eslint-plugin-prettier"),
    },
    rules: {
      // Add your custom rules here
    },
    extends: [
      "eslint:recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:prettier/recommended",
    ],
  },
];

export default config;