// Checks puzzle definitions in the browser (there is no command-line JavaScript here).
// LG.audit(game, defs) returns one row per puzzle: solutions found (up to 2),
// whether the bot finishes with direct steps only, and how many assumptions it needs.
(function () {
  'use strict';
  const LG = window.LG;
  LG.auditOne = function (gameId, def, opts) {
    opts = opts || {};
    const row = { id: def.id, set: def.set };
    try {
      const t0 = performance.now(), G = LG.games[gameId].create(def);
      const s = LG.solve(G, 2, opts.budget || 30000);
      row.solutions = s.gaveUp ? '?' : s.count; row.nodes = s.nodes;
      if (s.count === 1 && !s.gaveUp) {
        const pr = new LG.Proof(G), b = LG.botSolve(G, pr, opts.maxAssume === undefined ? 6 : opts.maxAssume);
        row.bot = b.ok; row.assume = b.assumptions;
        if (b.ok) { const f = pr.facts(); row.agrees = LG.branchVars(G).every(v => (f.has(v) ? f.get(v).val : 0) === s.solution.get(v).val); }
      }
      row.ms = Math.round(performance.now() - t0);
    } catch (e) { row.error = String(e && e.message || e); }
    return row;
  };
  LG.audit = (gameId, defs, opts) => defs.map(d => LG.auditOne(gameId, d, opts));
})();
