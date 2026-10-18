# Solver lab

This folder contains the inputs, adapters, pinned dependency locks and completed verification reports for the four restricted solution samples included in the app. The native solvers and their build caches stay outside the repository. The browser bundles only the verified JSON packs; it does not run a solver or fetch solver data.

The app also has a separate six-hand BTN–BB turn-to-river research course. Its numerical verification is pending and it is not eligible for scoring; it is not covered by the four reports in this folder.

## Reproduce the verification

On Windows, use Python 3.11 or newer and Node.js. The bootstrap downloads pinned Rust, C toolchain and solver source archives into a separate research directory. It does not change the global PATH or application dependencies. Set `POKER_SOLVER_LAB` to another non-encrypted directory if needed.

```powershell
python tools/solver-lab/bootstrap.py
python tools/solver-lab/test_lab.py
python tools/solver-lab/run.py
python tools/solver-lab/run_turn.py
python tools/solver-lab/run_line.py
```

The runners write detailed reports and engine output under `tools/solver-lab`. Pack exporters are separate, explicit steps; rerunning a solver does not replace app data automatically:

```powershell
node tools/solver-lab/export-packs.mjs
node tools/solver-lab/export-turn-pack.mjs
node tools/solver-lab/export-line-pack.mjs
```

## Included models and limits

- `fixtures.json` defines two river models with fixed ranges, a 10bb pot and either a 5bb or 10bb bet. Facing a bet, the only options are fold and call; after a check, the hand goes to showdown.
- `turn-fixtures.json` defines one fixed turn model. A turn bet can be folded to or called; the river is forced to check down.
- `line-fixture.json` defines one hand-authored, two-street turn and river model. Each player may check or bet half pot; facing a bet, only fold and call are available. There are no raises, automatic all-ins or rake.

Each case has declared ranges, actions, stack and pot sizes, payout assumptions and verification thresholds. The reports compare two pinned engines and independently enumerate the covered values and conditions. See `verification.json`, `turn-verification.json`, `line-verification.json` and `results/` for the recorded runs and raw engine output.

Report artifact hashes use LF-normalized content so Windows checkouts and Linux CI verify the same files.

These examples are conditional study references. Their ranges are not full preflop or flop solutions, their trees do not cover every legal action, and they do not establish a general GTO answer or a match to a real hand. The river-only checkdown branches cannot be trained as betting decisions. No sample automatically scores a user's hand.

The primary adapter is MIT licensed and the reference adapter is AGPL-3.0-or-later; their license texts are in `licenses/`. Neither native engine nor adapter is bundled in the web app.
