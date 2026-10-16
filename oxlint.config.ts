import { readdirSync } from "node:fs";
import { defineConfig, type OxlintOverride } from "oxlint";

/** One UI rule per feature: imports inside it are free. */
const FEATURES = readdirSync("features", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

export default defineConfig({
  $schema: "./node_modules/oxlint/configuration_schema.json",
  plugins: ["typescript", "react", "import", "jsx-a11y", "oxc", "unicorn"],
  // Project rules oxlint does not ship (tools/oxlint-plugin.ts).
  jsPlugins: ["./tools/oxlint-plugin.ts"],
  options: {
    typeAware: true,
    // The official compiler runs in `pnpm typecheck`; avoids duplicating the experimental type-check.
    typeCheck: false,
    reportUnusedDisableDirectives: "error",
    denyWarnings: true,
  },
  categories: {
    correctness: "error",
    suspicious: "warn",
  },
  env: {
    browser: true,
    node: true,
    es2024: true,
  },
  ignorePatterns: [
    ".react-router/**",
    "node_modules/**",
    "dist/**",
    "build/**",
    "coverage/**",
    "output/**",
    ".playwright-cli/**",
    "test-results/**",
    "playwright-report/**",
  ],
  settings: {
    "jsx-a11y": {
      components: { Link: "a", Input: "input", Label: "label" },
      attributes: { href: ["href", "to"] },
    },
  },
  rules: {
    "eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
    ],
    "eslint/no-debugger": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/await-thenable": "error",
    "typescript/no-explicit-any": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-type-assertion": "error",
    "typescript/consistent-type-imports": "error",
    "react/rules-of-hooks": "error",
    "react/exhaustive-deps": "error",
    "react/react-in-jsx-scope": "off",
    "import/no-cycle": ["error", { ignoreExternal: true }],
    "import/no-duplicates": "error",
    "import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
    // Redundant with TypeScript; conflicts with the "optional cleanup" pattern of effects.
    "typescript/consistent-return": "off",
    "jsx-a11y/no-autofocus": "error",
    // AGENTS.md §1.1: no `else` / `else if`; early returns and guard clauses instead.
    "nelcota/no-else": "error",

    // Size and complexity (docs/archive/refactor/03-target-architecture.md §4).
    "eslint/max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
    "eslint/complexity": ["error", { max: 15 }],
  },
  overrides: [
    // Layers (docs/archive/refactor/03-target-architecture.md §2). Each override says what
    // the folder must NOT import; the rest is free (no cycles, via import/no-cycle).
    {
      // Generic (shared UI and utilities): knows nothing about features, routes or the server.
      files: ["components/**", "lib/**"],
      rules: {
        "eslint/no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["@/features/*", "@/features/**", "@/app/*", "@/app/**"],
                allowTypeImports: true,
                message: "Generic code does not depend on features or routes.",
              },
              {
                group: ["@/server", "@/server/**", "pg", "drizzle-orm", "drizzle-orm/*"],
                allowTypeImports: true,
                message: "Generic code does not access the server or the database.",
              },
            ],
          },
        ],
      },
    },
    // Feature UI and hooks: data via props/loaders, mutations via actions; from another
    // feature's UI, only what is public (mascot, screen share notice and report dialog).
    ...FEATURES.map((feature): OxlintOverride => ({
      files: [
        `features/${feature}/ui/**`,
        `features/${feature}/hooks/**`,
        `features/${feature}/client/**`,
        `features/${feature}/*/ui/**`,
        `features/${feature}/*/hooks/**`,
        `features/${feature}/*/client/**`,
      ],
      rules: {
        "eslint/no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "@/server",
                  "@/server/**",
                  "@/features/**/server/**",
                  "pg",
                  "drizzle-orm",
                  "drizzle-orm/*",
                  "livekit-server-sdk",
                ],
                allowTypeImports: true,
                message: "UI does not access the server: use props, loaders or route actions.",
              },
              {
                group: [
                  "@/features/*/ui/**",
                  "@/features/*/*/ui/**",
                  `!@/features/${feature}/ui/**`,
                  `!@/features/${feature}/*/ui/**`,
                  "!@/features/mascot/ui/*",
                  "!@/features/room/ui/ShareSupportNote",
                  "!@/features/reports/ui/ReportDialog",
                  "!@/features/ringing/ui/CallButton",
                ],
                allowTypeImports: true,
                message:
                  "Another feature's UI is not public (only the mascot, the screen share notice, the report dialog and the call button).",
              },
            ],
          },
        ],
      },
    })),
    {
      // Domain: plain TypeScript (testable without React, router, database or SDK).
      files: ["features/*/domain/**", "features/*/*/domain/**"],
      rules: {
        "eslint/no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "react",
                  "react-dom",
                  "react-router",
                  "react-router/*",
                  "pg",
                  "drizzle-orm",
                  "drizzle-orm/*",
                  "livekit-client",
                  "livekit-server-sdk",
                  "better-auth",
                  "better-auth/*",
                  "@/server",
                  "@/server/**",
                  "@/features/**/server/**",
                  "@/features/**/ui/**",
                ],
                allowTypeImports: true,
                message: "domain/ is plain TypeScript: dependencies come in as parameters.",
              },
            ],
          },
        ],
      },
    },
    {
      // Server infra: only the features' domain (constants and pure types).
      files: ["server/**"],
      rules: {
        "eslint/no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "@/app/*",
                  "@/app/**",
                  "@/components/*",
                  "@/features/**/server/**",
                  "@/features/**/ui/**",
                  "@/features/**/hooks/**",
                  "@/features/**/client/**",
                  "@/features/**/actions",
                ],
                message: "Infra does not know about features (except domain/, which is pure).",
              },
            ],
          },
        ],
      },
    },
    {
      // Vendor (shadcn) and tests are exempt from the size limits.
      files: ["components/ui/**", "tests/**"],
      rules: { "eslint/max-lines": "off", "eslint/complexity": "off" },
    },
    {
      // Vendored shadcn code stays as upstream ships it.
      files: ["components/ui/**"],
      rules: { "nelcota/no-else": "off" },
    },
    {
      // Test fixtures build partial objects (DOM, HTTP responses, Better Auth
      // context) on purpose; in app code the rule still applies.
      files: ["tests/**"],
      rules: { "typescript/no-unsafe-type-assertion": "off" },
    },
    {
      files: ["features/auth/ui/SignUpForm.tsx"],
      // Oxlint leaves the valid HTML token `nickname` out of this rule's list.
      // https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill-field
      rules: { "jsx-a11y/autocomplete-valid": "off" },
    },
    {
      files: [
        "features/room/ui/dock/MicMenu.tsx",
        "features/room/ui/dock/Reactions.tsx",
        "features/room/ui/dock/SharePanel.tsx",
        "features/security/ui/TwoFactorSettings.tsx",
        "features/auth/ui/TwoFactorCodeForm.tsx",
      ],
      // Popovers opened by the user's action and single-field screens (the 2FA
      // code the user just requested): initial focus helps keyboard users.
      rules: { "jsx-a11y/no-autofocus": "off" },
    },
  ],
});
