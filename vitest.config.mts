import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',  // Use 'node' for server-side logic tests if needed
    setupFiles: './test/setup.ts',  // Path to your setup file
    include: [
      '**/__test__/**/*.{test,spec}.{ts,tsx}',  // Looks for test files inside `__test__` directories
      '**/test/**/*.{test,spec}.{ts,tsx}',  // Optionally include files in other test directories if needed
    ],
  },
});