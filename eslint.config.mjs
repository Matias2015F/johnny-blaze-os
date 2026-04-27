import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly", document: "readonly", localStorage: "readonly",
        console: "readonly", fetch: "readonly", setTimeout: "readonly",
        setInterval: "readonly", clearInterval: "readonly", clearTimeout: "readonly",
        Date: "readonly", Promise: "readonly", URLSearchParams: "readonly",
        Blob: "readonly", URL: "readonly", FileReader: "readonly",
        CustomEvent: "readonly", Buffer: "readonly", navigator: "readonly",
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "18" } },
    rules: {
      "react-hooks/rules-of-hooks":  "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/immutability":    "off", // falso positivo: window.location.href es intencional
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars":  "error",
      "react/prop-types":     "off", // sin PropTypes en este proyecto
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "error",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "api/**"],
  },
];
