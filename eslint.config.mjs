import { defineConfig, globalIgnores } from "eslint/config"
import jsxA11y from "eslint-plugin-jsx-a11y"
import reactHooks from "eslint-plugin-react-hooks"
import tailwind from "eslint-plugin-tailwindcss"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import tseslint from "typescript-eslint"

const typedFiles = ["**/*.{ts,tsx}"]

const typedConfigs = tseslint.configs.recommendedTypeChecked.map((config) => ({
  ...config,
  files: config.files ?? typedFiles,
}))

const reactHooksRecommended = { ...reactHooks.configs.flat.recommended }
delete reactHooksRecommended.plugins

const jsxA11yRecommended = { ...jsxA11y.flatConfigs.recommended }
delete jsxA11yRecommended.plugins

const tailwindRecommended = {
  ...tailwind.configs.recommended,
  settings: {
    tailwindcss: {
      ...tailwind.configs.recommended.settings?.tailwindcss,
      cssConfigPath: `${import.meta.dirname}/app/globals.css`,
    },
  },
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...typedConfigs,
  {
    files: typedFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          fixStyle: "inline-type-imports",
          prefer: "type-imports",
        },
      ],
      "@typescript-eslint/no-explicit-any": [
        "error",
        {
          fixToUnknown: true,
          ignoreRestArgs: false,
        },
      ],
      "@typescript-eslint/no-base-to-string": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/prefer-promise-reject-errors": "warn",
      "@typescript-eslint/require-await": "warn",
    },
  },
  {
    ...reactHooksRecommended,
    files: typedFiles,
  },
  {
    ...jsxA11yRecommended,
    files: ["**/*.tsx"],
  },
  tailwindRecommended,
  {
    // Mocks stand in for async signatures, so `vi.fn(async () => x)` is the
    // point rather than a missing await.
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },
  {
    files: typedFiles,
    rules: {
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/no-noninteractive-element-to-interactive-role": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "react-hooks/config": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/gating": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/incompatible-library": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/unsupported-syntax": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/void-use-memo": "warn",
      "tailwindcss/no-custom-classname": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Cloudflare Worker type definitions (cf-typegen / Wrangler):
    "cloudflare-env.d.ts",
    "worker-configuration.d.ts",
    // OpenNext Cloudflare build artifacts:
    ".open-next/**",
    // Wrangler build/dev bundle artifacts:
    ".wrangler/**",
    // Custom Cloudflare Worker entry (compiled by Wrangler, excluded from tsconfig):
    "worker.ts",
    // Vendored dav1d AV1 decoder: minified Emscripten output, not ours to lint.
    "lib/editor/animation-export/video-media/dav1d-wasm/decoder.mjs",
  ]),
])

export default eslintConfig
