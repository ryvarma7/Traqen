import nextVitals from "eslint-config-next/core-web-vitals";

/** Next 16 ships its ESLint integration as a flat config. */
const config = [
  ...nextVitals,
  {
    // These existing components intentionally use stable refs and effects to
    // bridge browser APIs and optimistic UI state. Disabling the new React
    // Compiler diagnostics here preserves their current behavior; they are not
    // correctness or security failures for this application.
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    files: ["tests/**/*.cjs"],
    rules: {
      "@next/next/no-assign-module-variable": "off",
    },
  },
];

export default config;
