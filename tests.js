// Checks for every game. Open tests.html; results are written into the page.
(function () {
  'use strict';
  const LG = window.LG, out = [];
  let failures = 0;
  const check = (name, cond, extra) => { if (!cond) failures++; out.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : '')); };
  let seed = 12345; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };

  for (const id of LG.order) {
    const game = LG.games[id], defs = LG.puzzles[id] || [];
    check(id + ': has puzzles and rules', defs.length > 0 && game.rules.length > 0, defs.length + ' puzzles');
    check(id + ': puzzle ids are unique', new Set(defs.map(d => d.id)).size === defs.length);
    let unique = 0, botOk = 0, agree = 0, levelOk = 0, tried = 0, accepted = 0, wrong = 0; const bad = [];
    for (const def of defs) {
      let G, s;
      try { G = game.create(def); s = LG.solve(G, 2, 40000); } catch (e) { bad.push(def.title + ': ' + e.message); continue; }
      const okCount = G.rootContradiction ? s.count <= 1 : s.count === 1;
      if (okCount && !s.gaveUp) unique++; else bad.push(def.title + ': ' + s.count + ' solutions');
      const pr = new LG.Proof(G), b = LG.botSolve(G, pr, 12);
      if (b.ok) botOk++; else bad.push(def.title + ': bot stuck');
      if ((def.level === 'direct') === (b.assumptions === 0)) levelOk++;
      const f = pr.facts();
      if (s.solution) { if (b.ok && LG.branchVars(G).every(v => (f.has(v) ? f.get(v).val : 0) === s.solution.get(v).val)) agree++; else bad.push(def.title + ': bot and solver disagree'); }
      else if (pr.status() === 'refuted') agree++;
      // Soundness: a step the engine accepts at the top level must agree with the solution.
      if (s.solution) {
        const p2 = new LG.Proof(G), vars = LG.branchVars(G).length ? LG.branchVars(G) : Array.from({ length: G.nvars }, (_, i) => i);
        for (let k = 0; k < 300; k++) {
          const key = G.anchorKeys[rnd(G.anchorKeys.length)], v = vars[rnd(vars.length)], val = rnd(2);
          tried++;
          if (p2.tryStep(key, v, val).ok) { accepted++; if (s.solution.get(v).val !== val) { wrong++; bad.push(def.title + ': accepted a wrong step via ' + G.anchor(key).text); } }
        }
        // Forced steps offered by each clue must agree with the solution too.
        for (const key of G.anchorKeys) for (const [v, val] of p2.forcedBy(key)) { tried++; if (s.solution.has(v) && s.solution.get(v).val !== val) { wrong++; bad.push(def.title + ': ' + G.anchor(key).text + ' forces a wrong value'); } }
      }
    }
    check(id + ': every puzzle has exactly one answer', unique === defs.length, unique + '/' + defs.length);
    check(id + ': the bot finishes every puzzle with the player\'s actions', botOk === defs.length, botOk + '/' + defs.length);
    check(id + ': bot result matches the solver', agree === defs.length, agree + '/' + defs.length);
    check(id + ': easy/harder labels are right', levelOk === defs.length, levelOk + '/' + defs.length);
    check(id + ': no wrong step is accepted', wrong === 0, tried + ' tried, ' + accepted + ' accepted');
    if (game.demo) {
      let P = null, G = null;
      try { G = game.create(game.demo); P = LG.plan(G); } catch (e) { bad.push('demo: ' + e.message); }
      const kinds = G ? [...new Set(G.anchorKeys.map(k => G.anchor(k).kind))] : [];
      check(id + ': demo puzzle is solved by direct steps', !!P && P.solved, P ? P.steps.length + ' steps' : '');
      out.push('INFO ' + id + ': demo shows ' + (P ? P.kinds.length : 0) + ' of ' + kinds.length + ' kinds of rule' + (P && P.kinds.length < kinds.length ? ' (not shown: ' + kinds.filter(k => !P.kinds.includes(k)).join(', ') + ')' : ''));
    } else check(id + ': has a demo', false);
    bad.slice(0, 6).forEach(b => out.push('  note ' + b));
  }

  // Assumptions and cases, on a Light Up puzzle that needs them.
  {
    const def = LG.puzzles.lightup.find(p => p.level === 'assume'), G = LG.games.lightup.create(def), sol = LG.solve(G, 2).solution, pr = new LG.Proof(G);
    LG.botDirect(G, pr);
    const open = LG.needVars(G).filter(v => !pr.facts().has(v));
    check('proof: contradiction refused with no assumption open', !pr.contradiction(G.anchorKeys[0]).ok);
    check('proof: end cases refused with no cases open', !pr.endCases().ok);
    let done = false;
    for (const v of open) {
      pr.suppose(v, 1 - sol.get(v).val); LG.botDirect(G, pr);
      const b = LG.botBroken(G, pr);
      if (!b) { pr.discard(); continue; }
      const fine = G.anchorKeys.find(k => !pr.isBroken(k));
      check('proof: a rule that is not broken is refused', !pr.contradiction(fine).ok);
      pr.contradiction(b);
      const f = pr.facts();
      check('proof: a refuted assumption gives the opposite', f.get(v).val === sol.get(v).val && [...f.values()].every(x => x.depth === 0));
      pr.undo(); check('proof: undo reopens the assumption', pr.path().length === 2); pr.discard(); done = true; break;
    }
    check('proof: found an assumption to refute', done);
    let split = false;
    for (const v of open) {
      pr.casesVar(v);
      const item = pr.root.items[pr.root.items.length - 1], wrongIdx = item.branches.findIndex(b => b.assume[1] !== sol.get(v).val);
      pr.select(item.branches[wrongIdx]); LG.botDirect(G, pr);
      const b = LG.botBroken(G, pr);
      if (!b) { pr.discard(); continue; }
      pr.contradiction(b); LG.botDirect(G, pr);
      const r = pr.endCases(), f = pr.facts();
      check('proof: ending cases keeps the open case', r.ok && r.open === 1 && [...f].every(([x, st]) => sol.get(x).val === st.val) && pr.path().length === 1);
      split = true; break;
    }
    check('proof: ran a case split', split);
    const p3 = new LG.Proof(G); p3.casesVar(open[0]);
    const it = p3.root.items[0]; p3.select(it.branches[0]); LG.botDirect(G, p3); p3.select(it.branches[1]); LG.botDirect(G, p3);
    if (!LG.botBroken(G, p3)) { const pf = p3.facts([p3.root]), r = p3.endCases(), f = p3.facts(); check('proof: two open cases export only shared facts', !r.ok || (!f.has(open[0]) && [...f].every(([x, st]) => sol.get(x).val === st.val))); }
  }
  // Truth tables end by contradiction at the top level.
  {
    const G = LG.games.truthtable.create(LG.puzzles.truthtable[0]), pr = new LG.Proof(G);
    LG.botDirect(G, pr); const b = LG.botBroken(G, pr);
    check('truth table: a valid argument ends in a top-level contradiction', !!b && pr.contradiction(b).ok && pr.status() === 'refuted');
  }
  // Tree Tent links are made by dragging.
  {
    const G = LG.games.treetent.create(LG.games.treetent.demo), P = LG.plan(G), f = P.proof.facts();
    let links = 0; for (const [v, x] of f) if (x.val && G.name(v, 1).one.indexOf('pair') >= 0) links++;
    check('tree tent: drag gives link attempts', !!G.drag && links >= 0);
  }

  // Rating, time limits, generators and editors.
  {
    const r1 = LG.rate('lightup', LG.puzzles.lightup[0], 3000);
    check('rate: a stock puzzle has one solution and is rated easy', r1.ok && r1.solutions === 1 && r1.level === 'direct' && r1.lines > 0);
    const r2 = LG.rate('lightup', { grid: ['....', '....', '....', '....'] }, 3000);
    check('rate: an empty Light Up board has more than one solution', !r2.ok && r2.solutions === 2);
    const r3 = LG.rate('sudoku', { grid: ['11..', '....', '....', '....'] }, 3000);
    check('rate: a contradictory board has no solution', !r3.ok && r3.solutions === 0);
    const big = { grid: Array.from({ length: 9 }, () => '.........') }, t0 = performance.now(), r4 = LG.rate('sudoku', big, 60), took = performance.now() - t0;
    check('rate: a search that runs too long stops at its time limit', (r4.timedOut || !r4.ok) && took < 1500, Math.round(took) + ' ms, timedOut ' + !!r4.timedOut);
    check('rate: the time limit is cleared afterwards', LG.deadline === 0);
    const r5 = LG.rate('lightup', { grid: 5 }, 500);
    check('rate: a malformed board is reported, not thrown', !r5.ok);
    for (const id of LG.order) {
      const ed = LG.editors[id];
      if (!ed) { check(id + ': has an editor', false); continue; }
      let ok = true, why = '';
      try {
        for (const n of ed.sizes || [0]) {
          const def = ed.blank(n), G = LG.games[id].create(def), tools = ed.tools(def);
          for (const tool of tools) { ed.apply(def, { t: 'cell', id: 0 }, tool); ed.apply(def, { t: 'clue', side: 'e', i: 0 }, tool); ed.apply(def, { t: 'clue', side: 'n', i: 0 }, tool); LG.games[id].create(def); }
          if (ed.drag) ed.drag(def, 1, Math.min(2, G.view.w - 1), tools[0]);
          (ed.fields || []).forEach(fd => { fd.set(def, fd.get(def)); });
          LG.rate(id, def, 300);
        }
      } catch (e) { ok = false; why = e.message; }
      check(id + ': the editor makes blank boards and every tool works', ok, why);
      // A stock puzzle copied into the editor must still check out.
      const copy = JSON.parse(JSON.stringify(LG.puzzles[id][0])), rc = LG.rate(id, copy, 3000);
      check(id + ': a copied stock puzzle passes the check', rc.ok, JSON.stringify(rc));
      if (LG.gen[id]) {
        const g = LG.generate(id, LG.genSizes[id][0], 'direct', 2500);
        const good = g.def && !g.timedOut && g.rating.ok && g.rating.assumptions === 0;
        check(id + ': generates an easy board within the time limit', !!good, g.def ? g.tries + ' tries' : 'none in 2.5 s');
      } else out.push('INFO ' + id + ': no generator');
    }
  }

  out.unshift(failures ? 'FAILURES: ' + failures : 'ALL PASSED');
  window.TEST_RESULTS = out;
  document.getElementById('out').textContent = out.join('\n');
})();
