# Handoff: Crystal of Atlan — Weekly Dungeon Planner redesign

Target repo: `ZeiTeria/Crystal-Of-Atlan` (main). Existing screens: `src/screens/PlanScreen.tsx`, `GridScreen.tsx`, `DungeonsScreen.tsx`, shell in `src/App.tsx`, tokens in `src/ui/tokens.css`.

## Overview
A redesign of the planner around **attempts as visible slots**. Instead of a character × dungeon number grid, the plan is shown as one card per dungeon with every weekly attempt drawn as a slot coloured by the character who runs it; unusable attempts are hatched amber. A second view (quest log) shows one character at a time with a stepper per dungeon. Also included: the public landing page, the add-character flow, and the phone layout.

## About the design files
`Crystal of Atlan Redesign.dc.html` is a **design reference built in HTML** — a prototype showing intended look and behaviour, not production code. Recreate the screens in the app's existing React/Vite environment using its own components and `tokens.css`. Only the sections badged **3A, 3B, 4A, 4B, 4C** are the approved direction; turns 1–2 on the same canvas are superseded and should be ignored.

## Fidelity
**High-fidelity.** Colours, type, spacing and interactions are final. Sample data (characters, dungeons, gold figures) is placeholder and comes from the real solver at runtime.

## Screens

### 3A — Attempt board (desktop, 1440 wide)
Purpose: read the whole week's plan at a glance.
Layout, top to bottom:
1. **Header** 60px, bottom rule. Left: logo mark (20px hex, gradient #7FA6FF→#4A6EF5) + "CRYSTAL OF ATLAN" 13px/800/letter-spacing .2em; then tab group (Board · History · Dungeons) 12px, active has `rgba(255,255,255,.06)` fill, inactive #5D6572. Right: "Week 36 · resets in {countdown}" (countdown #F9E57A 800 tabular), avatar 22px square + username.
2. **Summary strip**, bottom rule. Left cell 300px with right rule: label "ACCOUNT ATTEMPTS" (10px/800/.22em #8B93A1), "41" 44px/800 + "/ 48 used" 13px #5D6572, note "7 can't be spent — marked ▭ below" 12px #F9E57A. Then one **roster tile** per character (flex:1, right rule, padding 18px 20px): portrait 34px (see Portrait), name 13px/800, "N runs planned" / "parked this week" 11px #5D6572; below, gold "1000k gold" 11px #8B93A1 with "CAPPED" (#F9E57A) or "NN%" (#5D6572) right-aligned, 4px meter track `rgba(255,255,255,.07)` filled with character hue (or #F9E57A when capped). Last: "+ Add" 120px, dashed left rule, #5D6572 → #7FA6FF hover. Parked characters at 45% opacity.
3. **Board**: 4-column grid, 1px `rgba(255,255,255,.07)` gutters (grid gap on a grey background), one card per dungeon, background #0A0B0E, padding 20px 22px 18px, min-height 250px:
   - Group label 9px/800/.22em in group colour (Abyss #4A6EF5, Raid #A06EF5, Trial #4BA3C3); dungeon name 17px/800. Right: used count 17px/800 tabular, "of 18 attempts" 10px #5D6572.
   - **Slot track**: flex row, gap 3px, one `flex:1` 8px-tall span per attempt (18 or 12). Filled slot = character hue. Empty (unusable) slot = 1px border `rgba(249,229,122,.55)` + `repeating-linear-gradient(135deg, rgba(249,229,122,.35) 0 1px, transparent 1px 3px)`.
   - Who list: rows of diamond dot 8px (`clip-path: polygon(50% 0,100% 50%,50% 100%,0 50%)`, character hue) · name 13px · "3×" 13px/800 · gold "396k" 11px #5D6572 right-aligned 64px.
   - Footer, top rule: "132k per run" 11px #5D6572; "estimated" 9px/800/.16em #F9E57A only when the gold figure is a stand-in.

### 3B — Quest log (desktop, 1200×760)
Purpose: edit one character's plan.
- **Sidebar** 264px, right rule. Brand 18px mark + "ATLAN". "ROSTER" label. One row per character (padding 11px 22px): portrait 28px, name 13px/800, runs "18×" 11px #5D6572 right, 3px gold meter. Selected row: `rgba(255,255,255,.05)` fill + 3px inset left bar in character hue; unselected at 85% opacity (parked 50%). Bottom block, top rule: account totals "41 / 48 attempts", "4.18M gold", "Resets in {countdown}".
- **Main**: header (padding 28px 36px 22px, bottom rule) — portrait 52px, name 28px/800, summary "18 runs this week · gold cap reached" 13px #8B93A1; right: gold 26px/800 #F9E57A + "/ 1,000,000" 11px, 4px meter (min-width 220px).
- Body (padding 8px 36px 28px), scrolls. Three groups ABYSS / RAID / TRIAL: heading 10px/800/.22em in group colour + rule text "18 per week across the account, 3 per character" 11px #5D6572. Each dungeon row (padding 14px 0, bottom rule `rgba(255,255,255,.06)`): name 14px/800 + sub "132,000 per run · 18/18 used account-wide" 11px #5D6572; tier word 64px wide 11px/800 capitalised in tier colour; stepper `−` `n` `+` (28px square buttons, 1px `rgba(255,255,255,.1)` border, n 16px/800 in character hue, #3A414D when 0); gold 88px right-aligned 13px #8B93A1 ("—" when 0). Rows with 0 runs at 55% opacity.

### 4A — Landing (1440 wide)
- Header as 3A but nav = "How it works · GitHub · [SIGN IN WITH DISCORD]" (button #5865F2 → #6874F5 hover, 11px/800/.1em, padding 8px 14px, square corners).
- Hero grid `480px 1fr`, bottom rule. Left column (padding 56px 40px 56px 32px, right rule): kicker "WEEKLY DUNGEON PLANNER" 10px/800/.24em #7FA6FF; h1 54px/800/line-height 1: "48 attempts. / Six characters. / One plan."; paragraph 15px/1.6 #8B93A1 (copy in file); CTA "SIGN IN WITH DISCORD" #5865F2 padding 14px 22px; "Free. Only you can see your roster." 12px #5D6572.
- Right column: strip "A LIVE WEEK · HOVER A CHARACTER" / "41 / 48 attempts placed"; roster chip row (flex:1 each, portrait 28px + name 12px/800, hover fills `hue + 14` alpha, others dim to 40%); 2-column board preview using the first four dungeon cards (same slot track, compact who list).
- Steps row, 3 columns with vertical rules, padding 26px 32px: "01 · ADD YOUR ROSTER", "02 · THE SOLVER RUNS", "03 · RUN THE BOARD" 11px/800/.2em #7FA6FF + 13px #8B93A1 body.

### 4B — Add a character (modal/panel, 760 wide)
- Header (padding 22px 28px, bottom rule): live portrait 44px showing first letter of the typed name ("?" when empty) in chosen colour; title = typed name or "New character" 20px/800; sub "Joins the roster with 0 gold this week" 12px #5D6572; close × right.
- Two-column row, bottom rule: **NAME** — underline-only input (border-bottom 1px `rgba(255,255,255,.18)`, focus #4A6EF5, 16px). **COLOUR** — six 28px swatches (#4A6EF5 #A06EF5 #4BA3C3 #F0B23C #4ADE80 #F26B6B), chamfer clip, selected has 2px #E8EDF2 outline offset 3px, unselected 55% opacity.
- **HIGHEST TIER CLEARED** label + helper "Leave a dungeon on “none” and the solver will never send this character there." One row per dungeon (padding 11px 0, bottom rule): group tag 44px 9px/800 group colour, name 13px/800, segmented control (1px border `rgba(255,255,255,.1)`) with none / solo / story / elite / legend, 11px, padding 6px 11px; selected = `rgba(255,255,255,.08)` fill, tier colour, 800.
- Footer: "N of 8 dungeons unlocked" 12px #5D6572; Cancel (text) + "ADD TO ROSTER" (11px/800/.12em, padding 11px 20px; #4A6EF5 when name non-empty, else `rgba(255,255,255,.06)` #5D6572 and not-allowed).

### 4C — Phone (390×844, 40px corner radius on the device frame only)
Two tabs shown, shared bottom tab bar BOARD · LOG · DUNGEONS (10px/800/.16em, active #E8EDF2 with 2px inset top bar #4A6EF5, padding 14px 0 28px).
- **Board**: title "Board" 22px/800 + countdown #F9E57A; roster chip row (horizontal, `overflow-x:auto`, chips flex:1: portrait 28px over name 10px/800; selected chip has a 2px underline in hue, others 60%); totals row with top/bottom rules; then dungeon cards stacked (padding 16px 20px, bottom rule): group + name, used/cap, slot track (gap 2px), who list as wrapped inline chips.
- **Log**: same chip row; character header (name 18px/800, gold #F9E57A, 4px meter, summary); grouped dungeon rows with 34px stepper buttons (44px hit-target preferred in production) and tier word under the name.

## Shared elements
- **Portrait**: square with bottom-right chamfer `clip-path: polygon(0 0,100% 0,100% 72%,72% 100%,0 100%)`, background `hue` at 10% alpha (`hue + "1a"`), 1px border `hue` at 40% (`hue + "66"`), initial letter in hue, 800, font-size ≈ 0.42 × size.
- **Diamond dot** (character marker): 8px, `clip-path: polygon(50% 0,100% 50%,50% 100%,0 50%)`.
- **Logo mark**: hexagon `polygon(50% 0,100% 28%,100% 72%,50% 100%,0 72%,0 28%)`, `linear-gradient(150deg,#7FA6FF,#4A6EF5)`.
- No border radius anywhere except the phone device frame. No drop shadows. Rules are 1px `rgba(255,255,255,.07)`; stronger separators `.12`.

## Interactions
- Hovering a roster tile/chip (3A, 4A): other characters' slots and who-rows fade to 18% / 25% opacity, other tiles to 50%, hovered tile fills with hue at 8% alpha. 180ms ease.
- Clicking a roster row/chip (3B, 4C) selects that character; header and rows update.
- Stepper ± changes planned runs for that character/dungeon (bounded by the character cap of 3 and remaining account attempts); re-solve or mark plan as manually edited — product decision.
- 4B: Add disabled until name non-empty; tier segments and colour swatches are single-select.
- Countdown ticks every second to Monday 04:00 local, format `Nd Nh MMm SSs`.

## State
- `hovered: characterId | null`, `selected: characterId`, `tab: 'board' | 'log' | 'dungeons'`.
- Add-character form: `name`, `hue`, `tiers: Record<dungeonId, 'none'|'solo'|'story'|'elite'|'legend'>`.
- Data: characters (name, hue, earnedGold, plan[dungeonId] = runs), dungeons (name, group, weeklyCap 18|12, goldPerRun, isEstimate), account totals (attemptsUsed, attemptsTotal, gold, questsCovered), leftovers with reasons.

## Design tokens
- Background #07080A (page) / #0A0B0E (panels); text #E8EDF2; secondary #8B93A1; muted #5D6572; disabled #3A414D
- Blue #4A6EF5 / light #7FA6FF; gold #F9E57A; green #4ADE80; Discord #5865F2 → hover #6874F5
- Group colours: Abyss #4A6EF5, Raid #A06EF5, Trial #4BA3C3
- Tier colours: none #3A414D, solo #6B7280, story #4BA3C3, elite #A06EF5, legend #F0B23C
- Character hues (sample): #4A6EF5 #A06EF5 #4BA3C3 #F0B23C #4ADE80 #6B7280 (+ #F26B6B in picker)
- Font: SUITE (Medium 500 body, Heavy 800 emphasis), already in `src/assets/fonts/`. Labels: 9–11px, 800, letter-spacing .16–.24em, uppercase. `font-variant-numeric: tabular-nums` on all numbers.
- Spacing: 20/22/28/32px panel padding; 1px rules; radius 0.

## Assets
- `SUITE-Medium.woff2`, `SUITE-Heavy.woff2` from the repo. No images; marks are CSS clip-paths.

## Files
- `Crystal of Atlan Redesign.dc.html` — the canvas; use sections 3A, 3B, 4A, 4B, 4C (top two turns). Logic for sample data and computed styles is in the script block at the bottom (`roster`, `board`, `log`, `nc`).
- `support.js` — runtime needed to open the HTML locally.
