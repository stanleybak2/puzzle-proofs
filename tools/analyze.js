// Measures the proofs the bot writes, to find long ones and repeated patterns.
// At each point where no single rule forces anything, it tries every possible
// assumption and keeps the one with the shortest refutation. So the numbers are
// an upper bound on what a careful player needs, not a minimum.
(function () {
  'use strict';
  const LG = window.LG;
  // Inside an assumption: take one cited clue at a time and stop at the first broken rule.
  function refute(G, pr) {
    for (let guard = 0; guard < 2000; guard++) {
      const b = LG.botBroken(G, pr); if (b) return b;
      const key = G.anchorKeys.find(k => pr.forcedBy(k).length); if (!key) return null;
      pr.forcedBy(key).forEach(m => pr.tryStep(key, m[0], m[1]));
    }
    return null;
  }
  LG.analyzeOne = function (gameId, def, msBudget) {
    const G = LG.games[gameId].create(def), pr = new LG.Proof(G), t0 = performance.now(), refs = [];
    const row = { game: gameId, title: def.title, level: def.level, cells: G.view.w * G.view.h, vars: G.nvars };
    LG.botDirect(G, pr);
    row.directLines = pr.root.items.length;
    let stuck = false;
    while (!pr.solved()) {
      if (G.rootContradiction) { const b = LG.botBroken(G, pr); if (b && pr.contradiction(b).ok) break; }
      const f = pr.facts(), open = LG.branchVars(G).filter(v => !f.has(v)); let best = null, tried = 0, refutable = 0;
      for (const v of open) {
        for (const val of [1, 0]) {
          pr.suppose(v, val);
          const b = refute(G, pr); tried++;
          if (b) {
            refutable++;
            const blk = pr.path()[1], marks = blk.items.reduce((a, it) => a + it.marks.length, 0);
            if (!best || blk.items.length < best.lines || (blk.items.length === best.lines && marks < best.marks)) best = { v, val, lines: blk.items.length, marks, closeKind: G.anchor(b).kind, kinds: [...new Set(blk.items.map(it => G.anchor(it.anchor).kind))] };
          }
          pr.discard(); pr.hist.length = 0;
        }
        if (best && best.lines === 0) break;
        if (performance.now() - t0 > (msBudget || 20000) && best) break;
      }
      if (!best) { stuck = true; break; }
      pr.suppose(best.v, best.val); pr.contradiction(refute(G, pr)); pr.hist.length = 0;
      const n = G.name(best.v, best.val);
      refs.push({ lines: best.lines, marks: best.marks, closeKind: best.closeKind, kinds: best.kinds, assumed: n.one.replace(/\d+/g, 'N'), openAtStall: open.length, refutable: refutable + '/' + tried });
      LG.botDirect(G, pr);
    }
    const count = b => b.items.reduce((a, it) => a + (it.type === 'step' ? 1 : it.type === 'suppose' ? 2 + count(it.block) : 0), 0);
    row.solved = !stuck && pr.solved(); row.assumptions = refs.length; row.lines = count(pr.root);
    row.marks = pr.root.items.reduce((a, it) => a + (it.marks ? it.marks.length : 0), 0);
    row.longestRefutation = refs.reduce((a, r) => Math.max(a, r.lines), 0); row.refs = refs; row.ms = Math.round(performance.now() - t0);
    row.kinds = {}; const tally = b => b.items.forEach(it => { if (it.type === 'step') { const k = G.anchor(it.anchor).kind; row.kinds[k] = (row.kinds[k] || 0) + 1; } else if (it.type === 'suppose') tally(it.block); }); tally(pr.root);
    return row;
  };
  LG.analyzeAll = function (ids, msBudget) { const out = []; for (const id of ids || LG.order) for (const def of LG.puzzles[id]) out.push(LG.analyzeOne(id, def, msBudget)); return out; };
})();
