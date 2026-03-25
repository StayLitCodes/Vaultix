module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "next/typescript"],
  rules: {
    // Existing codebase uses `any` in many places; keep lint actionable.
    "@typescript-eslint/no-explicit-any": "off",
  },
};

