// `defineConfig` comes from vitest/config, NOT from vite: it is the same
// function with the `test` key typed. The older `/// <reference types="vitest" />`
// trick no longer works (removed in Vitest 3+), and tsconfig.node.json pins
// "types": ["node"], which suppresses ambient type references anyway.
import { defineConfig } from 'vitest/config';
// `loadEnv` is plain Vite - `vitest/config` re-exports only `defineConfig`.
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves this project from /Crystal-Of-Atlan/, not the domain root.
  base: '/Crystal-Of-Atlan/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Vitest runs in mode 'test', which loads only .env.test and .env.local -
    // so the project's public Supabase values, which live in .env.development,
    // are otherwise invisible to tests. Pull them in rather than keeping a
    // third copy of the same two keys.
    env: loadEnv('development', process.cwd(), 'VITE_'),
  },
});
