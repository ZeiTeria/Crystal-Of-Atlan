# Crystal Of Atlan — weekly dungeon planner

Works out which character should run which dungeon, how many times, given the
weekly attempt caps and the per-character gold cap.

**Live:** https://zeiteria.github.io/Crystal-Of-Atlan/

## Running it

```bash
git clone https://github.com/ZeiTeria/Crystal-Of-Atlan.git
cd Crystal-Of-Atlan
npm install
npm run dev
```

No setup step. The Supabase URL and publishable key are committed in
`.env.development` and `.env.production` on purpose — they ship inside the
browser bundle on a public site anyway, so hiding them buys nothing. Row Level
Security is the actual protection.

| Command | What it does |
|---|---|
| `npm run dev` | local dev server |
| `npm test` | full suite (~350 tests, takes ~15s) |
| `npm run build` | production build into `dist/` |
| `npx tsc -b --noEmit` | type check |

Pushing to `main` builds and deploys to GitHub Pages automatically
(`.github/workflows/deploy.yml`).

## Type

The UI is set in [SUITE](https://github.com/sun-typeface/SUITE) by SUNN, used
under the SIL Open Font License 1.1 — the same typeface the official Crystal of
Atlan site uses. The files in `src/assets/fonts/` are unmodified; `OFL.txt`
beside them is the licence.

Its default figures are proportional and uneven ("1" advances 408 units against
"0" at 708 in Medium), so anywhere digits line up or tick, the CSS must set
`font-variant-numeric: tabular-nums` — the font carries a `tnum` feature, which
is what makes that work.

## Layout

```
src/engine/    the planner. Pure TypeScript, no network, no database.
src/lib/       Supabase client, Discord auth.
src/App.tsx    the app. Currently login only.
supabase/      database schema as plain SQL. See supabase/README.md.
```

## The planner

Deciding runs is a **multiple-knapsack variant, and NP-hard**. The per-character
weekly gold cap is the only constraint that couples dungeons together — remove
it and each dungeon collapses into an independent sorted greedy. Keep it, and
no greedy rule is correct.

So `src/engine/solver.ts` runs an exact solver (HiGHS) over three objectives in
strict priority: spend every attempt, then cover weekly quests, then maximise
gold. Each pass pins the previous pass's optimum and re-solves.

`src/engine/oracle.ts` is an exhaustive enumerator. It is not used by the app —
it exists so the tests can compare the solver against the *provably* correct
answer on small instances, rather than against another heuristic. A greedy
comparison could only ever show the solver is no worse than greedy; it could
never catch the solver missing the true optimum, which is exactly the failure
that would quietly cost gold every week while looking fine.

**Do not swap the solver for `glpk.js` or `javascript-lp-solver`.** Both return
wrong integer optima here. glpk.js returned a plan earning 1,000,002 gold
against a 1,000,000 cap — a provably impossible answer — on 2 of 300 random test
instances. The cause is the coefficient magnitude ratio within one row
(500000:1 fails, 5:1 is fine), and it exposes no tolerance control. The
reproduction is recorded in `solver.ts`. Every returned plan is additionally
re-checked against every cap in integer arithmetic before it leaves the module.

## Status

Done: the engine, the database schema and its RLS policies, Discord sign-in,
and the Pages deploy.

Next: proving RLS isolates users with a test suite, mapping stored runs into
planner input, and the screens — plan, weekly gold, characters grid, dungeon
catalogue, history.
