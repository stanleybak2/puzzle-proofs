// Shared engine for every game. No DOM here.
//
// A game is a set of yes/no variables and a list of constraints over them.
// Constraint kinds:
//   lin: lo <= (number of true vars in pos) - (number of true vars in neg) <= hi
//   pat: the variables must match at least one of the listed patterns
//   fn:  custom code with forced(f) and broken(f); may be sound but incomplete
// A constraint with `auto` is applied for the player (the tedious rules).
// An anchor is a clue the player can click: it names one or more constraints.
(function (global) {
  'use strict';
  const LG = global.LG = { games: {}, puzzles: {}, deadline: 0 };
  const fail = msg => ({ ok: false, msg });
  // Long searches call tick(). When LG.deadline is set and has passed, the search stops with a 'timeout' error.
  const tick = () => { if (LG.deadline && performance.now() > LG.deadline) throw new Error('timeout'); };

  // ---------- constraints ----------
  function linState(c, f) {
    let cur = 0; const up = [], dn = [];
    for (const v of c.pos) { const x = f.get(v); if (!x) up.push(v); else if (x.val) cur++; }
    if (c.neg) for (const v of c.neg) { const x = f.get(v); if (!x) dn.push(v); else if (x.val) cur--; }
    return { cur, up, dn, min: cur - dn.length, max: cur + up.length };
  }
  const patOk = (p, f) => p.every(([v, val]) => { const x = f.get(v); return !x || x.val === val; });
  function broken(c, f) {
    if (c.k === 'lin') { const s = linState(c, f); return s.max < c.lo || s.min > c.hi; }
    if (c.k === 'pat') return !c.pats.some(p => patOk(p, f));
    return c.broken(f);
  }
  // Everything this one constraint forces: [[v, val], ...]
  function forced(c, f) {
    const out = [];
    if (c.k === 'lin') {
      const s = linState(c, f);
      if (s.max < c.lo || s.min > c.hi) return out;
      for (const v of s.up) { if (s.min + 1 > c.hi) out.push([v, 0]); else if (s.max - 1 < c.lo) out.push([v, 1]); }
      for (const v of s.dn) { if (s.max - 1 < c.lo) out.push([v, 0]); else if (s.min + 1 > c.hi) out.push([v, 1]); }
      return out;
    }
    if (c.k === 'pat') {
      const ok = c.pats.filter(p => patOk(p, f));
      if (!ok.length) return out;
      for (const [v, val] of ok[0]) if (!f.has(v) && ok.every(p => p.some(e => e[0] === v && e[1] === val))) out.push([v, val]);
      return out;
    }
    return c.forced(f);
  }
  function autoOf(c, f) {
    if (c.auto === 'hi') { const s = linState(c, f); return s.cur >= c.hi ? s.up.map(v => [v, 0]) : []; }
    const all = forced(c, f);
    return typeof c.auto === 'function' ? all.filter(e => c.auto(e[0], e[1])) : all;
  }
  function conVars(c) {
    if (c.vars !== undefined) return c.vars;
    if (c.k === 'lin') return (c.vars = c.neg ? c.pos.concat(c.neg) : c.pos);
    if (c.k === 'pat') { const s = new Set(); c.pats.forEach(p => p.forEach(e => s.add(e[0]))); return (c.vars = [...s]); }
    return (c.vars = null);   // null: the constraint may talk about any variable
  }
  // Apply the automatic constraints until nothing changes.
  function runAuto(G, f, depth) {
    const autos = G._autos || (G._autos = G.cons.filter(c => c.auto));
    for (let changed = true; changed;) {
      changed = false;
      for (const c of autos) for (const [v, val] of autoOf(c, f)) if (!f.has(v)) { f.set(v, { val, depth, auto: true }); changed = true; }
    }
  }
  function baseFacts(G) {
    const f = new Map();
    for (const [v, val] of G.givens || []) f.set(v, { val, depth: 0, given: true });
    runAuto(G, f, 0);
    return f;
  }
  const needVars = G => G.need || (G.need = Array.from({ length: G.nvars }, (_, i) => i));
  // The variables the solver and the bot branch on (defaults to the ones a solution must decide).
  const branchVars = G => G.solveVars || needVars(G);
  function complete(G, f) {
    return needVars(G).every(v => f.has(v)) && !G.cons.some(c => broken(c, f)) && (!G.check || G.check(f));
  }

  // ---------- solver (used to check puzzles, not shown to the player) ----------
  function propagate(G, f) {
    for (let changed = true; changed;) {
      changed = false; tick();
      for (const c of G.cons) {
        if (broken(c, f)) return false;
        for (const [v, val] of forced(c, f)) if (!f.has(v)) { f.set(v, { val, depth: 0 }); changed = true; }
      }
    }
    return true;
  }
  // Count solutions up to `limit`. Returns {count, solution, nodes, gaveUp}.
  function solve(G, limit, budget) {
    limit = limit || 2; budget = budget || 200000;
    const res = { count: 0, solution: null, nodes: 0, gaveUp: false }, need = branchVars(G), seen = new Set();
    const rec = f => {
      if (res.count >= limit || res.gaveUp) return;
      if (++res.nodes > budget) { res.gaveUp = true; return; }
      if (!propagate(G, f)) return;
      const v = need.find(x => !f.has(x));
      if (v === undefined) {
        if (G.check && !G.check(f)) return;
        const key = need.map(x => f.get(x).val).join('');
        if (seen.has(key)) return;
        seen.add(key); res.count++; if (!res.solution) res.solution = new Map(f);
        return;
      }
      for (const val of [1, 0]) { const g = new Map(f); g.set(v, { val, depth: 0 }); rec(g); }
    };
    rec(baseFacts(G));
    return res;
  }

  // ---------- proof ----------
  // block: {kind:'root'|'suppose'|'case', assume:[v,val]|null, items:[], closed:null|{anchor}|{byCases:true}}
  // items: {type:'step', anchor, marks:[[v,val]]} | {type:'suppose', block}
  //        | {type:'cases', src, branches:[block], sel, ended, exports:[[v,val]]}
  const newBlock = (kind, assume) => ({ kind, assume: assume || null, items: [], closed: null });
  class Proof {
    constructor(G) { this.G = G; this.root = newBlock('root'); this.hist = []; this._ver = 0; this._cache = null; }
    touch() { this._ver++; this._cache = null; }
    snap() { this.hist.push(JSON.stringify(this.root)); this.touch(); }
    undo() { if (!this.hist.length) return fail('Nothing to undo.'); this.root = JSON.parse(this.hist.pop()); this.touch(); return { ok: true }; }
    path() {
      const p = [this.root]; let b = this.root;
      for (;;) {
        const it = b.items[b.items.length - 1];
        if (!it) break;
        if (it.type === 'suppose' && !it.block.closed) b = it.block;
        else if (it.type === 'cases' && !it.ended) b = it.branches[it.sel];
        else break;
        p.push(b);
        if (b.closed) break;
      }
      return p;
    }
    // Everything known at the end of the path: var -> {val, depth, auto, assumed, given}
    facts(path) {
      const own = !path;
      if (own && this._cache) return this._cache;
      path = path || this.path();
      const G = this.G, f = baseFacts(G);
      path.forEach((b, d) => {
        if (b.assume) f.set(b.assume[0], { val: b.assume[1], depth: d, assumed: true });
        for (const it of b.items) {
          if (it.type === 'step') it.marks.forEach(m => f.set(m[0], { val: m[1], depth: d }));
          else if (it.type === 'suppose' && it.block.closed) f.set(it.block.assume[0], { val: 1 - it.block.assume[1], depth: d });
          else if (it.type === 'cases' && it.ended) it.exports.forEach(m => f.set(m[0], { val: m[1], depth: d }));
        }
        runAuto(G, f, d);
      });
      if (own) this._cache = f;
      return f;
    }
    _open(path) { const b = path[path.length - 1]; return b.closed ? null : b; }
    _cons(key) { const a = this.G.anchor(key); return a ? a.cons.map(i => this.G.cons[i]) : []; }
    forcedBy(key, f) {
      f = f || this.facts();
      const out = [], seen = new Set();
      for (const c of this._cons(key)) for (const m of forced(c, f)) { const k = m[0] * 2 + m[1]; if (!f.has(m[0]) && !seen.has(k)) { seen.add(k); out.push(m); } }
      return out;
    }
    isBroken(key, f) { f = f || this.facts(); return this._cons(key).some(c => broken(c, f)); }

    // A direct step: v gets val because the cited rule alone forces it.
    tryStep(key, v, val) {
      const G = this.G, path = this.path(), blk = this._open(path);
      if (!blk) return fail('This case is already closed by a contradiction. Click another case, or end the cases.');
      const f = this.facts(), cons = this._cons(key);
      if (!cons.length) return fail('That clue cannot be cited here.');
      if (f.has(v)) {
        const x = f.get(v), n = G.name(v, x.val);
        return fail(n.who + ' already ' + n.one + (x.auto ? ' (the game worked that out for you).' : '.'));
      }
      if (!cons.some(c => { const vs = conVars(c); return !vs || vs.includes(v); })) return fail('That is not something this rule talks about.');
      if (!cons.some(c => forced(c, f).some(m => m[0] === v && m[1] === val))) return fail(this.explainNo(key, v, val, f));
      this.snap();
      const last = blk.items[blk.items.length - 1];
      if (last && last.type === 'step' && last.anchor === key) last.marks.push([v, val]);
      else blk.items.push({ type: 'step', anchor: key, marks: [[v, val]] });
      return { ok: true };
    }
    explainNo(key, v, val, f) {
      const G = this.G, a = G.anchor(key), cons = this._cons(key);
      if (cons.some(c => broken(c, f))) return 'This rule is already broken, so it cannot justify a step.';
      for (const c of cons) { const t = c.why && c.why(v, val, f); if (t) return t; }
      const opp = cons.some(c => forced(c, f).some(m => m[0] === v && m[1] === 1 - val));
      if (opp) { const n = G.name(v, 1 - val); return 'This rule forces the opposite: ' + n.who + ' ' + n.one + '.'; }
      const c = cons.find(x => x.k === 'lin' && !x.neg && x.pos.includes(v));
      if (c && a.count) {
        const s = linState(c, f), want = c.lo === c.hi ? 'exactly ' + c.lo : c.hi >= 90 ? 'at least ' + c.lo : c.lo + ' to ' + c.hi;
        return 'This rule needs ' + want + ' of the outlined ' + a.count + '. It has ' + s.cur + ' so far and ' + s.up.length + ' still undecided, so this one is not forced yet.';
      }
      return 'This rule alone does not force that yet.';
    }
    suppose(v, val) {
      const path = this.path(), blk = this._open(path);
      if (!blk) return fail('This case is already closed. Click another case, or end the cases.');
      if (this.facts().has(v)) return fail('Pick something that is still undecided.');
      this.snap();
      blk.items.push({ type: 'suppose', block: newBlock('suppose', [v, val]) });
      return { ok: true };
    }
    _addCases(blk, src, assumes) {
      this.snap();
      blk.items.push({ type: 'cases', src, sel: 0, ended: false, exports: [], branches: assumes.map(a => newBlock('case', a)) });
      return { ok: true };
    }
    casesVar(v) {
      const path = this.path(), blk = this._open(path);
      if (!blk) return fail('This case is already closed. Click another case, or end the cases.');
      if (this.facts().has(v)) return fail('Pick something that is still undecided.');
      return this._addCases(blk, { v }, [[v, 1], [v, 0]]);
    }
    // Cases from a rule that still needs something: one case per remaining choice.
    casesAnchor(key) {
      const path = this.path(), blk = this._open(path);
      if (!blk) return fail('This case is already closed. Click another case, or end the cases.');
      const f = this.facts(), cons = this._cons(key);
      if (!cons.length) return fail('That clue cannot be cited here.');
      if (cons.some(c => broken(c, f))) return fail('This rule is already broken. Declare the contradiction instead.');
      for (const c of cons) {
        if (c.k !== 'lin' || c.neg) continue;
        const s = linState(c, f);
        if (s.cur >= c.lo) continue;
        if (s.up.length < 2 || s.cur + s.up.length === c.lo) return fail('Nothing is left to choose here: that is a direct step.');
        return this._addCases(blk, { anchor: key }, s.up.map(v => [v, 1]));
      }
      return fail('This rule does not leave a choice right now.');
    }
    contradiction(key) {
      const path = this.path(), blk = this._open(path);
      if (!blk) return fail('This case is already closed.');
      const f = this.facts();
      if (!this._cons(key).length) return fail('That clue cannot be cited here.');
      if (!this.isBroken(key, f)) return fail('This rule can still be satisfied, so it is not broken.');
      if (path.length === 1 && !this.G.rootContradiction) return fail('There is no assumption to contradict here.');
      this.snap();
      blk.closed = { anchor: key };
      this._afterClose(path);
      return { ok: true };
    }
    _afterClose(path) {
      if (path.length < 2) return;
      const parent = path[path.length - 2], item = parent.items[parent.items.length - 1];
      if (item.type !== 'cases') return;
      const open = item.branches.findIndex(b => !b.closed);
      if (open >= 0) { item.sel = open; return; }
      item.ended = true; item.exports = [];
      if (path.length > 2 || this.G.rootContradiction) { parent.closed = { byCases: true }; this._afterClose(path.slice(0, -1)); }
    }
    _innerCases(path) {
      for (let i = path.length - 1; i >= 1; i--) {
        const item = path[i - 1].items[path[i - 1].items.length - 1];
        if (item.type === 'cases' && !item.ended) return { i, item };
      }
      return null;
    }
    inCases() { return !!this._innerCases(this.path()); }
    // End a case split: whatever holds in every open case holds outside it.
    endCases() {
      const G = this.G, path = this.path(), found = this._innerCases(path);
      if (!found) return fail('There is no open case split to end.');
      const { i, item } = found, parentPath = path.slice(0, i);
      for (let k = 0; k < item.branches.length; k++) {
        const br = item.branches[k], last = br.items[br.items.length - 1];
        if (!br.closed && last && ((last.type === 'suppose' && !last.block.closed) || (last.type === 'cases' && !last.ended)))
          return fail('Case ' + (k + 1) + ' still has an open assumption or case split inside it. Finish or discard that first.');
      }
      const live = item.branches.filter(b => !b.closed);
      if (!live.length) return fail('Every case is closed already.');
      const pf = this.facts(parentPath);
      let common = null;
      for (const br of live) {
        const bf = this.facts([...parentPath, br]), m = new Map();
        for (const [v, x] of bf) if (!pf.has(v)) m.set(v, x.val);
        if (common === null) common = m;
        else for (const [v, val] of [...common]) if (m.get(v) !== val) common.delete(v);
      }
      if (!common.size) return fail('Nothing has the same value in every open case yet. Keep deducing inside the cases.');
      // List only what the automatic rules would not re-derive from the rest.
      const order = [...common].sort((x, y) => (y[1] - x[1]) || (x[0] - y[0])), keep = [], g = new Map(pf), d = parentPath.length - 1;
      for (const [v, val] of order) if (!g.has(v)) { keep.push([v, val]); g.set(v, { val, depth: d }); runAuto(G, g, d); }
      this.snap();
      item.ended = true; item.exports = keep;
      return { ok: true, n: keep.length, open: live.length };
    }
    discard() {
      const path = this.path();
      if (path.length < 2) return fail('There is no open assumption or case split to discard.');
      this.snap();
      path[path.length - 2].items.pop();
      return { ok: true };
    }
    select(target) {
      const dfs = b => {
        if (b === target) return true;
        const it = b.items[b.items.length - 1];
        if (!it) return false;
        if (it.type === 'suppose' && !it.block.closed) return dfs(it.block);
        if (it.type === 'cases' && !it.ended)
          for (let k = 0; k < it.branches.length; k++) if (dfs(it.branches[k])) { it.sel = k; return true; }
        return false;
      };
      const r = dfs(this.root); this.touch(); return r;
    }
    // 'solved', 'refuted' (a contradiction with no assumption: nothing satisfies the rules), or null
    status() {
      if (this.root.closed) return 'refuted';
      if (this.path().length !== 1) return null;
      return complete(this.G, this.facts()) ? 'solved' : null;
    }
    solved() { return !!this.status(); }
  }

  // ---------- bot: plays through the same actions the player has ----------
  function botDirect(G, pr, onStep) {
    const keys = G.anchorKeys;
    for (let moved = true; moved;) {
      moved = false; tick();
      for (const key of keys) {
        const fs = pr.forcedBy(key);
        if (!fs.length) continue;
        for (const [v, val] of fs) { const r = pr.tryStep(key, v, val); if (r.ok) moved = true; }
        if (onStep) onStep(key, fs);
      }
    }
  }
  const botBroken = (G, pr) => G.anchorKeys.find(k => pr.isBroken(k)) || null;
  // Returns {ok, assumptions}. Uses direct steps, then one-level assumptions.
  function botSolve(G, pr, maxAssume) {
    let assumptions = 0;
    botDirect(G, pr);
    while (!pr.solved()) {
      if (G.rootContradiction) { const b = botBroken(G, pr); if (b && pr.contradiction(b).ok) break; }
      if (assumptions >= (maxAssume === undefined ? 40 : maxAssume)) return { ok: false, assumptions };
      let progress = false;
      const f = pr.facts();
      outer: for (const v of branchVars(G)) {
        if (f.has(v)) continue;
        for (const val of [1, 0]) {
          pr.suppose(v, val); botDirect(G, pr);
          const b = botBroken(G, pr);
          if (b) { pr.contradiction(b); assumptions++; progress = true; botDirect(G, pr); break outer; }
          pr.discard();
        }
      }
      if (!progress) return { ok: false, assumptions };
    }
    return { ok: true, assumptions };
  }

  // A walk-through made of direct steps only: [{key, marks}], one cited clue per entry.
  // It prefers a kind of rule that has not been shown yet. Used for the demos.
  function plan(G) {
    const pr = new Proof(G), steps = [], used = new Set();
    for (let guard = 0; guard < 600 && !pr.solved(); guard++) {
      const ready = G.anchorKeys.filter(k => pr.forcedBy(k).length);
      if (!ready.length) break;
      const key = ready.find(k => !used.has(G.anchor(k).kind)) || ready[0], f = pr.facts(), marks = pr.forcedBy(key, f);
      steps.push({ key, marks, facts: f });
      used.add(G.anchor(key).kind);
      marks.forEach(m => pr.tryStep(key, m[0], m[1]));
    }
    if (G.rootContradiction && !pr.solved()) { const b = botBroken(G, pr); if (b) { steps.push({ key: b, marks: [], facts: pr.facts(), broken: true }); used.add(G.anchor(b).kind); pr.contradiction(b); } }
    return { steps, solved: pr.solved(), kinds: [...used], proof: pr };
  }
  // A random full assignment that satisfies the rules, or null.
  function randomSolution(G, rnd, budget) {
    let nodes = 0; const vars = branchVars(G);
    const rec = f => {
      if (++nodes > (budget || 20000) || !propagate(G, f)) return null;
      const open = vars.filter(v => !f.has(v));
      if (!open.length) return !G.check || G.check(f) ? f : null;
      const v = open[Math.floor(rnd() * open.length)], first = rnd() < 0.5 ? 1 : 0;
      for (const val of [first, 1 - first]) { const g = new Map(f); g.set(v, { val, depth: 0 }); const r = rec(g); if (r) return r; }
      return null;
    };
    return rec(baseFacts(G));
  }

  // Check and rate one board within a time limit (milliseconds).
  // {solutions: 0 | 1 | 2 (meaning more than one), ok, solved, assumptions, lines, level, timedOut, error}
  function rate(gameId, def, ms) {
    const out = { ok: false }, t0 = performance.now();
    LG.deadline = t0 + (ms || 3000);
    try {
      const G = LG.games[gameId].create(def), s = solve(G, 2, 1e9);
      out.solutions = s.count;
      out.ok = G.rootContradiction ? s.count <= 1 : s.count === 1;
      if (out.ok) {
        const pr = new Proof(G), b = botSolve(G, pr, 12);
        const count = blk => blk.items.reduce((a, it) => a + (it.type === 'step' ? 1 : it.type === 'suppose' ? 2 + count(it.block) : 0), 0);
        out.solved = b.ok; out.assumptions = b.assumptions; out.lines = count(pr.root);
        out.level = !b.ok ? 'beyond' : b.assumptions === 0 ? 'direct' : 'assume';
      }
    } catch (e) { if (e && e.message === 'timeout') out.timedOut = true; else out.error = String((e && e.message) || e); }
    LG.deadline = 0;
    out.ms = Math.round(performance.now() - t0);
    return out;
  }

  // ---------- helpers shared by game files ----------
  const grid = (w, h) => {
    const g = { w, h, n: w * h };
    g.id = (r, c) => r * w + c;
    g.rc = id => [Math.floor(id / w), id % w];
    g.inside = (r, c) => r >= 0 && c >= 0 && r < h && c < w;
    g.cn = id => String.fromCharCode(65 + (id % w)) + (Math.floor(id / w) + 1);
    g.nb4 = id => { const [r, c] = g.rc(id); return [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(d => g.inside(r + d[0], c + d[1])).map(d => g.id(r + d[0], c + d[1])); };
    g.nb8 = id => { const [r, c] = g.rc(id), o = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && g.inside(r + dr, c + dc)) o.push(g.id(r + dr, c + dc)); return o; };
    g.row = r => Array.from({ length: w }, (_, c) => g.id(r, c));
    g.col = c => Array.from({ length: h }, (_, r) => g.id(r, c));
    return g;
  };
  // Connected groups of the cells for which `inSet` is true (4-neighbour).
  function components(g, inSet) {
    const comp = new Array(g.n).fill(-1), groups = [];
    for (let s = 0; s < g.n; s++) {
      if (comp[s] !== -1 || !inSet(s)) continue;
      const q = [s], grp = []; comp[s] = groups.length;
      while (q.length) { const x = q.pop(); grp.push(x); for (const y of g.nb4(x)) if (comp[y] === -1 && inSet(y)) { comp[y] = groups.length; q.push(y); } }
      groups.push(grp);
    }
    return { comp, groups };
  }
  // A game builder collects constraints and anchors.
  function builder() {
    const B = { cons: [], anchors: {}, anchorKeys: [] };
    B.con = c => { B.cons.push(c); return B.cons.length - 1; };
    B.lin = (pos, lo, hi, extra) => B.con(Object.assign({ k: 'lin', pos, lo, hi }, extra || {}));
    // An anchor with info:true only explains a rule the game applies by itself. It is never needed for a step.
    B.anchor = (key, a) => { if (!B.anchors[key]) { B.anchors[key] = Object.assign({ key, cons: [], cells: [] }, a); if (!a.info) B.anchorKeys.push(key); } return B.anchors[key]; };
    // Automatic pair rule "these two may not both be set", remembered per cell so a piece can show it.
    B.apart = (a, b, va, vb, by) => { const i = B.lin([va, vb], 0, 1, { auto: 'hi' }); (by[a] = by[a] || []).push(i); (by[b] = by[b] || []).push(i); };
    return B;
  }

  Object.assign(LG, { Proof, forced, broken, linState, conVars, baseFacts, runAuto, complete, solve, botDirect, botBroken, botSolve, grid, components, builder, needVars, branchVars, propagate, plan, randomSolution, rate, tick });
})(typeof window !== 'undefined' ? window : globalThis);
