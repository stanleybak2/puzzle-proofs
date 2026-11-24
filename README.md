# Puzzle proofs

Solve grid puzzles as proofs, in the browser. Every mark needs a reason, and the reason is always one of the game's own rules.

This is a design experiment for [LEGUP](https://github.com/Bram-Hub/LEGUP) (Logic Engine for Grid-Using Puzzles), the RPI project for teaching logic through grid puzzles. It covers all 14 LEGUP games with one interface. It grew out of an earlier single-game prototype, [lightup-proof](https://github.com/stanleybak2/lightup-proof).

Play it at https://stanleybak2.github.io/puzzle-proofs/

## How it works

- **Only the base rules are axioms.** Each game has a handful of rules. There is no catalogue of named derived rules to pick from.
- **You cite a rule by clicking its clue.** A clue is a number, a cell, a row or column label, a tree, a circle or a connective, depending on the game. Then you mark something, and the step is accepted only if that one rule forces it.
- **The game applies the tedious rules for you.** In Light Up a lit cell counts as empty. In Sudoku a placed digit removes itself from the candidates around it. Each game's rules list says which rules are automatic.
- **The proof is a list with nested boxes.** *Assume* opens an assumption, and a broken rule inside it proves the opposite. *Case split* opens cases side by side, and ending the cases keeps what is true in every open case.
- **Each game starts with a demo.** The first time you open a game it walks through a small puzzle that uses the game's rules. You can skip it, and you can replay it with "Show demo".

## Games

| Game | Puzzles | Source of the puzzles |
|---|---|---|
| Light Up | 64 | LEGUP |
| Sudoku | 31 | LEGUP 9x9, generated 4x4 |
| Binary | 30 | LEGUP, generated 4x4 |
| Fillapix | 11 | LEGUP, generated |
| Minesweeper | 8 | LEGUP, generated |
| Star Battle | 9 | generated, LEGUP |
| Thermometer | 11 | generated, one from LEGUP |
| Skyscrapers | 10 | LEGUP, generated 3x3 |
| Tree Tent | 10 | generated |
| Battleship | 8 | generated |
| Nurikabe | 30 | LEGUP |
| Heyawake | 8 | generated |
| Masyu | 15 | LEGUP |
| Short Truth Table | 12 | written for this project, one from LEGUP |

That is 257 puzzles. Every one was checked by a solver to have exactly one solution. A Short Truth Table puzzle has either one counterexample or none.

**Which LEGUP boards are included.** Every LEGUP sample board that passes three checks: it has exactly one solution, the checker can rate it, and the check finishes in about a second. Boards left out: those with no solution or several, a few too hard to rate, Fillapix boards too slow to check, and Nurikabe boards larger than 10 by 10, which were not tried. LEGUP has no sample files for Battleship and Heyawake. Its Tree Tent files store the row counts twice in place of the column counts, so they have no solution, and the Tree Tent puzzles here are generated. LEGUP's Short Truth Table files do not say which statement is the conclusion, so only one was adapted by hand.

## Making puzzles

"New puzzle" on any game opens a screen where you can:

- **Generate** a board of a chosen size and difficulty. Easy means direct steps are enough. Medium needs one or two assumptions. Hard needs three or more. Short Truth Table has no generator.
- **Edit** a board. Start from a blank board, a copy of the puzzle you were playing, or a generated one. Pick a tool and click the board. Thermometers are drawn by dragging from the bulb to the tip.
- **Check** it. The checker confirms a single solution and rates the difficulty by solving the board with the same actions a player has. It reports the number of assumptions and proof lines.
- **Save and play.** Only a board with a single solution can be saved. Saved boards are kept in the browser and appear at the end of the puzzle list as "Mine".
- **Share.** "Puzzle as text" shows the whole board as one line of text that can be copied, and loaded on another computer.

Checks and generation have time limits (6 and 8 seconds). They run in a background worker, so the page stays responsive, and a search that overruns is stopped.

## Known limits

- **Area rules are not complete.** Nurikabe's island and connection rules, Heyawake's connection rule, Battleship's fleet rule and Masyu's single loop rule are hand-written checks. They never accept a wrong step. They do refuse some true steps that need a longer argument about the whole board. For those, use Assume or Case split.
- **Tree Tent counts as solved when every cell is decided.** Links between trees and tents are only required where a step depends on them.
- **Battleship has no ship-part hints.** A given cell is ship or water. The fleet is listed under the board.
- **Two demos miss a rule.** The Binary demo does not use the "no two rows are the same" rule, and the Masyu demo does not use the single loop rule. Both rules are in the rules list.
- **Touch screens are untested.** Marking uses the left and right mouse buttons, and Tree Tent links use a drag.

## Running it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8766
```

`tests.html` runs the checks in the browser. For every puzzle it confirms the single solution, solves it using only the actions a player has, and compares the two results. It also tries random steps and confirms that every accepted step agrees with the solution.

## Files

- `core.js`: constraints, the proof structure, the solver and the bot. No DOM.
- `games/*.js`: one entry per game with its variables, constraints, clues and drawing.
- `ui.js`, `index.html`, `style.css`: the shared interface.
- `gen.js`: the puzzle generators. `editor.js`: the board editors. `worker.js`: runs checks and generation in the background.
- `puzzles/all.js`: the puzzles and the demo puzzles.
- `tests.js`, `tests.html`: the checks.
- `tools/`: how the puzzle file was made. `convert.py` reads LEGUP's sample files. `dev.html` loads `tools/audit.js` and `gen.js` to check and generate puzzles in the browser, and `tools/analyze.js` to measure proof lengths. `build_puzzles.py` writes `puzzles/all.js` from `tools/selected.json`.

## Adding a game

A game is a set of yes/no variables and a list of constraints. `core.js` knows three kinds of constraint: a count over a set of variables, a list of allowed patterns, and custom code. A game file registers its clues as anchors, each naming the constraints it stands for. The existing files in `games/` are the examples to follow. `games/counting.js` has the shortest ones.

## Licence

The LEGUP sample puzzles come from a GPL-3.0 repository, so this project is released under GPL-3.0 as well. See `LICENSE`.
