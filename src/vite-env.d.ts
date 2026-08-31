/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;

  // Row level security test users. Absent in a normal clone - see the manual
  // prerequisites in the data-spine plan - so the suite skips without them.
  readonly VITE_TEST_A_EMAIL?: string;
  readonly VITE_TEST_A_PASSWORD?: string;
  readonly VITE_TEST_B_EMAIL?: string;
  readonly VITE_TEST_B_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
