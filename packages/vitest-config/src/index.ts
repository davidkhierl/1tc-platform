import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest configuration for the 1TC platform monorepo.
 * This configuration provides common settings that can be extended by individual packages.
 */
export const sharedConfig = defineConfig({
  test: {
    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,

    // Set the test environment
    environment: 'node',

    // Coverage configuration
    coverage: {
      provider: 'istanbul',
      reporter: [
        'text',
        'json',
        'html',
        [
          'json',
          {
            file: 'coverage.json',
          },
        ],
      ],
      enabled: true,
      // Include source files for coverage
      include: ['src/**/*.{ts,tsx,js,jsx}'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test/**',
        '**/tests/**',
        '**/__tests__/**',
      ],
    },

    // Test file patterns
    include: [
      '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '**/tests/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],

    // Exclude patterns
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '.next/**',
      '.turbo/**',
    ],

    // Reporter configuration
    reporters: ['verbose'],

    // Test timeout
    testTimeout: 10000,

    // Setup files (can be overridden by individual packages)
    setupFiles: [],
  },
});

/**
 * Base configuration for Node.js packages
 */
export const baseConfig = defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    environment: 'node',
  },
});

/**
 * Configuration for UI packages that need jsdom environment
 */
export const uiConfig = defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    environment: 'jsdom',
    // UI-specific setup files can be added here
    setupFiles: ['./src/test/setup.ts'],
  },
});
