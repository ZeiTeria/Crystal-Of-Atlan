// `defineConfig` comes from vitest/config, NOT from vite: it is the same
// function with the `test` key typed. The older `/// <reference types="vitest" />`
// trick no longer works (removed in Vitest 3+), and tsconfig.node.json pins
// "types": ["node"], which suppresses ambient type references anyway.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves this project from /Crystal-Of-Atlan/, not the domain root.
  base: '/Crystal-Of-Atlan/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
