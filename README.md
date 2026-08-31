# Crystal Of Atlan — weekly dungeon planner

Works out which character should run which dungeon, how many times, given the
weekly attempt caps and the per-character gold cap.

- `npm test` — run the engine test suite
- `npm run dev` — local dev server
- `npm run build` — production build

The planner core lives in `src/engine/` and is pure TypeScript: no network, no
database. `src/engine/oracle.ts` is an exhaustive enumerator used only to prove
the real solver in `src/engine/solver.ts` returns true optima.
