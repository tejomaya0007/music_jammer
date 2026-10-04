import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/sql/**/*.test.ts', 'tests/unit/**/*.test.ts', 'tests/component/**/*.test.tsx', 'tests/pwa/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 120_000,
    setupFiles: ['tests/setup.ts'],
  },
});
