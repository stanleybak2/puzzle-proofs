// Puzzle generators, run in the browser from dev.html. They make the puzzles for
// games LEGUP has no usable sample files for, and the small demo puzzles.
// Every result is checked with the solver: exactly one solution.
(function () {
  'use strict';
  const LG = window.LG, GEN = LG.gen = {};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const shuffle = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const unique = (id, def) => { const s = LG.solve(LG.games[id].create(def), 2, 20000); return s.count === 1 && !s.gaveUp; };
  const direct = (id, def) => { const G = LG.games[id].create(def), pr = new LG.Proof(G); LG.botDirect(G, pr); return pr.solved(); };
  // Drop clues one at a time while the puzzle stays good.
  function thin(r, items, build, good) { let cur = items.slice(); for (const it of shuffle(r, items)) { const next = cur.filter(x => x !== it); if (good(build(next))) cur = next; } return build(cur); }
  const rowsOf = (g, f) => Array.from({ length: g.h }, (_, r) => g.row(r).filter(f).length), colsOf = (g, f) => Array.from({ length: g.w }, (_, c) => g.col(c).filter(f).length);
  const chars = (g, f) => Array.from({ length: g.h }, (_, r) => g.row(r).map(f).join(''));

  GEN.treetent = (r, o) => {
    const n = o.n, g = LG.grid(n, n), tents = new Set(), trees = new Set(), want = Math.round(n * n / 5);
    for (let t = 0; t < 600 && tents.size < want; t++) {
      const c = Math.floor(r() * g.n);
      if (trees.has(c) || tents.has(c) || g.nb8(c).some(x => tents.has(x))) continue;
      const opts = g.nb4(c).filter(x => !trees.has(x) && !tents.has(x));
      if (!opts.length) continue;
      tents.add(c); trees.add(pick(r, opts));
    }
    return { grid: chars(g, id => (trees.has(id) ? 'T' : '.')), rows: rowsOf(g, id => tents.has(id)), cols: colsOf(g, id => tents.has(id)) };
  };
  GEN.thermometer = (r, o) => {
    const w = o.n, h = o.n, g = LG.grid(w, h), used = new Set(), vials = [], full = new Set();
    for (const c of shuffle(r, Array.from({ length: g.n }, (_, i) => i))) {
      if (used.has(c)) continue;
      let best = [c];
      for (const d of shuffle(r, [[0, 1], [1, 0], [0, -1], [-1, 0]])) {
        const v = [c], len = 2 + Math.floor(r() * 3); let [rr, cc] = g.rc(c);
        while (v.length < len) { rr += d[0]; cc += d[1]; if (!g.inside(rr, cc) || used.has(g.id(rr, cc))) break; v.push(g.id(rr, cc)); }
        if (v.length > best.length) best = v;
        if (best.length > 1) break;
      }
      best.forEach(x => used.add(x)); vials.push(best);
      const lvl = Math.floor(r() * (best.length + 1)); best.slice(0, lvl).forEach(x => full.add(x));
    }
    return { w, h, vials, rows: rowsOf(g, id => full.has(id)), cols: colsOf(g, id => full.has(id)) };
  };
  GEN.battleship = (r, o) => {
    const n = o.n, g = LG.grid(n, n), ship = new Set(), fleet = o.fleet;
    for (const len of fleet) {
      let ok = false;
      for (let t = 0; t < 200 && !ok; t++) {
        const hor = r() < 0.5, r0 = Math.floor(r() * (hor ? n : n - len + 1)), c0 = Math.floor(r() * (hor ? n - len + 1 : n));
        const cells = Array.from({ length: len }, (_, i) => g.id(r0 + (hor ? 0 : i), c0 + (hor ? i : 0)));
        if (cells.some(c => ship.has(c) || g.nb8(c).some(x => ship.has(x)))) continue;
        cells.forEach(c => ship.add(c)); ok = true;
      }
      if (!ok) return null;
    }
    const def = { w: n, h: n, rows: rowsOf(g, id => ship.has(id)), cols: colsOf(g, id => ship.has(id)), fleet, given: [] };
    for (const c of shuffle(r, Array.from({ length: g.n }, (_, i) => i))) {
      if (unique('battleship', def)) return def;
      if (def.given.length >= (o.maxGiven === undefined ? 4 : o.maxGiven)) return null;
      def.given.push([c, ship.has(c) ? 1 : 0]);
    }
    return null;
  };
  GEN.heyawake = (r, o) => {
    const w = o.n, h = o.n, g = LG.grid(w, h), room = new Array(g.n).fill('?'); let next = 0;
    const split = (r0, c0, hh, ww) => {
      if (hh * ww <= 2 || (hh * ww <= 6 && r() < 0.55) || next > 40) { const L = String.fromCharCode(next < 26 ? 65 + next : 71 + next); next++; for (let i = 0; i < hh; i++) for (let j = 0; j < ww; j++) room[g.id(r0 + i, c0 + j)] = L; return; }
      if ((hh > ww || (hh === ww && r() < 0.5)) && hh > 1) { const k = 1 + Math.floor(r() * (hh - 1)); split(r0, c0, k, ww); split(r0 + k, c0, hh - k, ww); }
      else { const k = 1 + Math.floor(r() * (ww - 1)); split(r0, c0, hh, k); split(r0, c0 + k, hh, ww - k); }
    };
    split(0, 0, h, w);
    const regions = chars(g, id => room[id]), black = new Set();
    const connected = () => LG.components(g, id => !black.has(id)).groups.length <= 1;
    const tryAdd = c => { if (black.has(c) || g.nb4(c).some(x => black.has(x))) return false; black.add(c); if (connected()) return true; black.delete(c); return false; };
    for (const c of shuffle(r, Array.from({ length: g.n }, (_, i) => i))) if (r() < 0.45) tryAdd(c);
    const G0 = LG.games.heyawake.create({ regions, nums: {} });
    for (let pass = 0; pass < 4; pass++) for (const c of G0.cons) if (c.k === 'lin' && c.lo === 1 && !c.pos.some(x => black.has(x))) for (const x of shuffle(r, c.pos)) if (tryAdd(x)) break;
    if (G0.cons.some(c => c.k === 'lin' && c.lo === 1 && !c.pos.some(x => black.has(x)))) return null;
    const nums = {}; for (let id = 0; id < g.n; id++) nums[room[id]] = (nums[room[id]] || 0) + (black.has(id) ? 1 : 0);
    const def = { regions, nums };
    if (!unique('heyawake', def)) return null;
    return thin(r, Object.keys(nums), keys => ({ regions, nums: Object.fromEntries(keys.map(k => [k, nums[k]])) }), d => unique('heyawake', d) && (!o.direct || direct('heyawake', d)));
  };
  GEN.starbattle = (r, o) => {
    const n = o.n, g = LG.grid(n, n);
    let p = null;
    for (let t = 0; t < 300 && !p; t++) { const q = shuffle(r, Array.from({ length: n }, (_, i) => i)); if (q.every((c, i) => i === 0 || Math.abs(c - q[i - 1]) > 1)) p = q; }
    if (!p) return null;
    const reg = new Array(g.n).fill(-1); p.forEach((c, i) => { reg[g.id(i, c)] = i; });
    for (let left = g.n - n; left > 0;) { const c = Math.floor(r() * g.n); if (reg[c] >= 0) continue; const nb = g.nb4(c).filter(x => reg[x] >= 0); if (!nb.length) continue; reg[c] = reg[pick(r, nb)]; left--; }
    return { stars: 1, regions: chars(g, id => String.fromCharCode(65 + reg[id])) };
  };
  // Games where the puzzle is a solved grid with most of it hidden.
  const fromSolution = (id, r, blank, show, good) => {
    const G = LG.games[id].create(blank), sol = LG.randomSolution(G, r);
    if (!sol) return null;
    return show(G, sol, good);
  };
  GEN.sudoku = (r, o) => {
    const n = o.n, blank = { grid: Array.from({ length: n }, () => '.'.repeat(n)) };
    return fromSolution('sudoku', r, blank, (G, sol) => {
      const digit = id => { for (let d = 0; d < n; d++) if (sol.get(id * n + d).val) return d + 1; };
      const build = keep => ({ grid: Array.from({ length: n }, (_, rr) => Array.from({ length: n }, (_, c) => (keep.includes(rr * n + c) ? digit(rr * n + c) : '.')).join('')) });
      return thin(r, Array.from({ length: n * n }, (_, i) => i), build, d => unique('sudoku', d) && (!o.direct || direct('sudoku', d)));
    });
  };
  GEN.binary = (r, o) => {
    const n = o.n, blank = { grid: Array.from({ length: n }, () => '.'.repeat(n)) };
    return fromSolution('binary', r, blank, (G, sol) => {
      const build = keep => ({ grid: Array.from({ length: n }, (_, rr) => Array.from({ length: n }, (_, c) => (keep.includes(rr * n + c) ? sol.get(rr * n + c).val : '.')).join('')) });
      return thin(r, Array.from({ length: n * n }, (_, i) => i), build, d => unique('binary', d) && (!o.direct || direct('binary', d)));
    });
  };
  GEN.skyscrapers = (r, o) => {
    const n = o.n, none = () => Array.from({ length: n }, () => null), blank = { n, clues: { n: none(), s: none(), e: none(), w: none() } };
    return fromSolution('skyscrapers', r, blank, (G, sol) => {
      const g = LG.grid(n, n), ht = id => { for (let d = 0; d < n; d++) if (sol.get(id * n + d).val) return d; };
      const see = line => { let top = -1, k = 0; for (const id of line) if (ht(id) > top) { top = ht(id); k++; } return k; };
      const all = { n: i => see(g.col(i)), s: i => see(g.col(i).reverse()), w: i => see(g.row(i)), e: i => see(g.row(i).reverse()) }, items = [];
      for (const s of 'nsew') for (let i = 0; i < n; i++) items.push(s + i);
      const build = keep => { const cl = { n: none(), s: none(), e: none(), w: none() }; keep.forEach(k => { cl[k[0]][+k.slice(1)] = all[k[0]](+k.slice(1)); }); return { n, clues: cl }; };
      return thin(r, items, build, d => unique('skyscrapers', d) && (!o.direct || direct('skyscrapers', d)));
    });
  };
  // Clue puzzles on a random picture: put a clue everywhere, then thin them out.
  GEN.fillapix = (r, o) => {
    const n = o.n, g = LG.grid(n, n), black = new Set(); for (let id = 0; id < g.n; id++) if (r() < 0.5) black.add(id);
    const k = id => [id, ...g.nb8(id)].filter(x => black.has(x)).length;
    const build = keep => ({ grid: chars(g, id => (keep.includes(id) ? k(id) : '.')) });
    return thin(r, Array.from({ length: g.n }, (_, i) => i), build, d => unique('fillapix', d) && (!o.direct || direct('fillapix', d)));
  };
  GEN.minesweeper = (r, o) => {
    const n = o.n, g = LG.grid(n, n), mine = new Set(); for (let id = 0; id < g.n; id++) if (r() < 0.3) mine.add(id);
    const safe = Array.from({ length: g.n }, (_, i) => i).filter(id => !mine.has(id));
    const build = keep => ({ grid: chars(g, id => (keep.includes(id) ? g.nb8(id).filter(x => mine.has(x)).length : '.')) });
    if (!unique('minesweeper', build(safe))) return null;
    return thin(r, safe, build, d => unique('minesweeper', d) && (!o.direct || direct('minesweeper', d)));
  };
  GEN.lightup = (r, o) => {
    const n = o.n, g = LG.grid(n, n), wall = new Set(); for (let id = 0; id < g.n; id++) if (r() < 0.22) wall.add(id);
    const blank = { grid: chars(g, id => (wall.has(id) ? '#' : '.')) }, G = LG.games.lightup.create(blank), sol = LG.randomSolution(G, r);
    if (!sol) return null;
    const whites = Array.from({ length: g.n }, (_, i) => i).filter(id => !wall.has(id)), bulb = new Set(whites.filter((id, v) => sol.get(v).val));
    const build = keep => ({ grid: chars(g, id => (!wall.has(id) ? '.' : keep.includes(id) ? g.nb4(id).filter(x => bulb.has(x)).length : '#')) });
    if (!unique('lightup', build([...wall]))) return null;
    return thin(r, [...wall], build, d => unique('lightup', d) && (!o.direct || direct('lightup', d)));
  };
  GEN.nurikabe = (r, o) => {
    const n = o.n, g = LG.grid(n, n), grid = Array.from({ length: n }, () => new Array(n).fill(0));
    const k = 2 + Math.floor(r() * (o.islands || 2)); let left = Math.floor(n * n * 0.45);
    for (let i = 0; i < k; i++) { const id = Math.floor(r() * g.n), v = i === k - 1 ? Math.max(1, left) : 1 + Math.floor(r() * Math.min(4, left)); if (grid[Math.floor(id / n)][id % n]) return null; grid[Math.floor(id / n)][id % n] = v; left -= v; if (left < 0) return null; }
    return { grid };
  };
  GEN.masyu = (r, o) => {
    const n = o.n, g = LG.grid(n, n), k = (o.pearls || 3) + Math.floor(r() * 2), at = new Map();
    for (let i = 0; i < k; i++) at.set(Math.floor(r() * g.n), r() < 0.5 ? 'W' : 'B');
    return { grid: chars(g, id => at.get(id) || '.') };
  };

  // Try seeds until `count` good puzzles are found. `want` is 'direct', 'assume', or 'any'.
  LG.make = function (id, opts, count, want, seed0, maxTries) {
    const out = [], seenKeys = new Set(); let seed = seed0 || 1;
    for (let t = 0; t < (maxTries || 400) && out.length < count; t++, seed++) {
      let def = null;
      try { def = GEN[id](rng(seed * 7919 + 13), opts); } catch (e) { def = null; }
      if (!def) continue;
      const key = JSON.stringify(def); if (seenKeys.has(key)) continue; seenKeys.add(key);
      const row = LG.auditOne(id, def, { maxAssume: opts.maxAssume === undefined ? 4 : opts.maxAssume });
      if (row.solutions !== 1 || !row.bot || !row.agrees) continue;
      if (want === 'direct' && row.assume !== 0) continue;
      if (want === 'assume' && row.assume === 0) continue;
      def.level = row.assume === 0 ? 'direct' : 'assume'; def.seed = seed;
      out.push(def);
    }
    return out;
  };
  // A demo puzzle: solvable with direct steps, and showing as many kinds of rule as possible.
  LG.makeDemo = function (id, opts, tries, seed0) {
    let best = null;
    for (let t = 0, seed = seed0 || 1000; t < (tries || 300); t++, seed++) {
      let def = null;
      try { def = GEN[id](rng(seed * 104729 + 7), Object.assign({ direct: true }, opts)); } catch (e) { def = null; }
      if (!def) continue;
      const G = LG.games[id].create(def);
      if (LG.solve(G, 2, 20000).count !== 1) continue;
      const P = LG.plan(G); if (!P.solved) continue;
      const kinds = new Set(G.anchorKeys.map(k => G.anchor(k).kind)), score = P.kinds.length * 100 - P.steps.length;
      if (!best || score > best.score) best = { def, score, kinds: P.kinds, all: [...kinds], steps: P.steps.length };
      if (P.kinds.length === kinds.size && P.steps.length <= (opts.maxSteps || 14)) break;
    }
    return best;
  };
})();
