import { config as baseConfig } from "./base.js";
import nodePlugin from "eslint-plugin-n";

/**
 * ESLint configuration for Node.js applications.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nodeConfig = [
  ...baseConfig,
  ...nodePlugin.configs["flat/recommended"],
  {
    languageOptions: {
      globals: {
        ...nodePlugin.environments.node.globals,
      },
    },
    rules: {
      "n/no-missing-import": "off", // TypeScript handles this
      "n/no-unsupported-features/es-syntax": "off", // We target modern Node.js
      "n/prefer-global/process": "error",
      "n/prefer-global/buffer": "error",
      "n/prefer-global/console": "error",
      "n/prefer-global/url": "error",
      "n/prefer-global/url-search-params": "error",
    },
  },
];
