import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  // 1) Global ignores (replacement for .eslintignore)
  {
    ignores: ['node_modules', 'dist', 'build', 'coverage', 'prettier.config.cjs'],
  },

  // 2) Base JS rules (like "eslint:recommended")
  js.configs.recommended,

  // 3) TypeScript recommended rules
  ...tseslint.configs.recommended,

  // 4) Project-specific tweaks
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
