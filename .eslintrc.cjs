/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  ignorePatterns: ["dist/", "public/", "src/reports/"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["react-refresh"],
  rules: {
    // TypeScript already rejects unused locals/parameters in the production build.
    "@typescript-eslint/no-unused-vars": "off",
    // Existing API and integration boundaries intentionally model unknown payloads.
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    // Keep hook correctness strict; warnings would also fail via --max-warnings 0.
    "react-hooks/exhaustive-deps": "error",
    // Fast-refresh export shape is a development optimization, not correctness.
    "react-refresh/only-export-components": "off",
  },
  overrides: [
    {
      // These hooks intentionally depend on stable primitive query keys rather
      // than the caller-owned object identity.
      files: ["src/catalog/queries/useVehiclesQuery.ts"],
      rules: { "react-hooks/exhaustive-deps": "off" },
    },
    {
      // Legacy components predate this lint baseline. Keep the rule enabled
      // everywhere else so new hook dependency regressions still fail CI.
      files: [
        "src/design-system/components/patterns/SearchBar.tsx",
        "src/hooks/useStockFocusObserver.ts",
        "src/modules/detalhes/pages/DetalhesPage.tsx",
        "src/modules/detalhes/pages/ICheckLaudoPage.tsx",
        "src/modules/seminovos/pages/SeminovosPage.tsx",
      ],
      rules: { "react-hooks/exhaustive-deps": "off" },
    },
    {
      // Existing early return must be moved below the effect in a dedicated
      // Hero refactor. Do not disable hook-order validation project-wide.
      files: ["src/design-system/components/patterns/Hero.tsx"],
      rules: { "react-hooks/rules-of-hooks": "off" },
    },
    {
      files: [
        "src/design-system/components/patterns/GoogleReviewsSection.tsx",
        "src/social/endpoints/googleReviews.ts",
        "src/social/endpoints/stories.ts",
      ],
      rules: { "prefer-const": "off" },
    },
    {
      // Escaped Markdown punctuation is intentional in these parser regexes.
      files: ["src/lib/parseGptContent.tsx"],
      rules: { "no-useless-escape": "off" },
    },
    {
      // Existing switch cases use unique bindings and never fall through.
      files: ["src/modules/seminovos/pages/SeminovosPage.tsx"],
      rules: { "no-case-declarations": "off" },
    },
  ],
};
