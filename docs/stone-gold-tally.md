# Stone gold tally

Fill in `stone-gold-tally.csv`, one row per run. The rows already there are an
example shape, not data — overwrite them.

| column | what |
|---|---|
| `date` | so runs can be grouped by reset week |
| `character` | optional, but it makes a weird row traceable |
| `dungeon` | Checkmate, The Deep Dive, … |
| `difficulty` | solo / story / elite / legend |
| `mode` | `skip` (timeskip) or `manual` (played by hand) |
| `stones` | how many dropped: 0, 1, 2, 3 |
| `gold` | gold from the clear |
| `notes` | anything odd |

## The three questions, and the least data that answers each

**1. Is gold linear in stone count?** (Checkmate)

Run Checkmate at ONE difficulty and record every run. The per-stone value is
just `mean gold at 1 stone − mean gold at 0 stones`. Then check whether a
2-stone run pays `base + 2P`.

18 account attempts a week is plenty for 0-vs-1. A 3-stone drop is rare enough
that week one may show none — that half takes a few weeks.

**2. Is the per-stone value P the same everywhere, or per-dungeon?**

Worth knowing, because it decides how much has to change. If a stone is a
global item worth a fixed amount, **P is global and only the RATE differs per
dungeon** — which fits what you noticed, that Checkmate drops *more* stones
rather than more valuable ones.

Measure P on two or three dungeons and compare. Same method as above: mean at 1
stone minus mean at 0.

**3. Does timeskip pay the same as manual?**

The app already assumes yes — `manual` only paces runs, it never touches gold.
So this is testing an assumption already baked in.

You do NOT need to test this per dungeon. Whether a timeskip pays the clear
reward is a game-wide rule: either it does or it does not. So take ONE
skippable dungeon at ONE difficulty, play 3-5 runs by hand, and compare against
the skip runs you already have. That answers it for The Deep Dive in advance of
it ever becoming skippable.

## The two mistakes that waste a week

- **Not recording the 0-stone runs.** The temptation is to write down only the
  runs where something happened. Without a 0-stone baseline there is no way to
  separate `base` from the stone premium — the interesting rows are worthless
  on their own.
- **Mixing difficulties in one comparison.** Base gold differs per tier, so a
  mixed sample hides the very slope you are measuring. Hold difficulty fixed,
  or keep enough rows to split by it.

## What happens after

If gold is linear, the fix is small: `gold_*_stone` comes to mean "gold with
exactly one stone", the rate moves from `app_settings` onto `dungeons`, and the
`check (stone_rate <= 1)` in `0013` is dropped — because it is then an expected
COUNT, not a probability, and Checkmate's can exceed 1. The engine does not
change; it still collapses to one integer gold-per-run.

If gold is not linear, it needs a per-count table, which is a real change and
probably not worth it.
