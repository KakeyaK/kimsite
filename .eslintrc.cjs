const fs = require("node:fs");

// Each folder in src/apps is one app (see CLAUDE.md, "Apps").
const apps = fs.readdirSync(`${__dirname}/src/apps`, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: ["@typescript-eslint", "jsx-a11y", "import"],
  settings: {
    // Resolves the tsconfig aliases (@apps/..., @lib/...) so the zones below see where imports really go
    "import/resolver": { typescript: true },
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:astro/recommended",
    "plugin:jsx-a11y/recommended",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
    // Apps stay apart: an app never imports another app, and the site only imports apps from
    // route files (src/pages), never from its own components, layouts or helpers.
    "import/no-restricted-paths": ["error", {
      zones: [
        ...apps.map((app) => ({
          target: `./src/apps/${app}`,
          from: "./src/apps",
          except: [`./${app}`],
          message: "Apps never import from each other.",
        })),
        {
          target: ["./src/!(apps|pages)/**", "./src/*.*"],
          from: "./src/apps",
          message: "Only route files in src/pages may import an app.",
        },
      ],
    }],
  },
  overrides: [
    { files: ["*.ts", "*.tsx"] }, // ESLint 8 only lints .js by default; this opts TS files in
    {
      files: ["*.astro"],
      parser: "astro-eslint-parser",
      parserOptions: {
        parser: "@typescript-eslint/parser",
        extraFileExtensions: [".astro"],
      },
    },
  ],
  ignorePatterns: ["dist/", ".astro/", "public/", "node_modules/"],
};
