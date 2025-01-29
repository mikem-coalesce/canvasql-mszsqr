module.exports = {
  root: true,
  parser: "@typescript-eslint/parser", // @typescript-eslint/parser ^6.2.0
  parserOptions: {
    project: "./tsconfig.json",
    ecmaVersion: 2022,
    sourceType: "module"
  },
  plugins: [
    "@typescript-eslint", // @typescript-eslint/eslint-plugin ^6.2.0
    "prettier" // eslint-plugin-prettier ^5.0.0
  ],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier" // eslint-config-prettier ^8.8.0
  ],
  env: {
    node: true,
    jest: true,
    es2022: true
  },
  rules: {
    // TypeScript specific rules
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error", 
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/restrict-template-expressions": "error",
    "@typescript-eslint/unbound-method": "error",

    // Prettier integration
    "prettier/prettier": "error",

    // General code quality rules
    "no-console": "warn",
    "no-debugger": "error",
    "no-duplicate-imports": "error",
    "no-unused-expressions": "error",
    "no-var": "error",
    "prefer-const": "error",
    "eqeqeq": ["error", "always"]
  },
  overrides: [
    {
      // Relaxed rules for test files
      files: ["**/*.test.ts", "**/*.spec.ts"],
      env: {
        jest: true
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-member-access": "off"
      }
    }
  ],
  settings: {
    "import/resolver": {
      typescript: {
        project: "./tsconfig.json"
      }
    }
  },
  ignorePatterns: [
    "dist",
    "coverage", 
    "node_modules",
    "*.js"
  ]
};