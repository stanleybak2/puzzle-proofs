// Games with rules about connected areas: Nurikabe, Heyawake, Battleship.
// Their area rules are hand-written checks. They are sound (they never accept a
// wrong step) but not complete: a true step that needs a longer argument about
// the whole board is refused, and the player uses Assume or Case split instead.
(function () {
  'use strict';
  const LG = window.LG;
  const base = (B, extra) => Object.assign({ cons: B.cons, anchor: k => B.anchors[k], anchorKeys: B.anchorKeys }, extra);
  // Remember the last answer for a facts object (facts only ever grow).
  const memo = fn => { let lf = null, ls = -1, lr = null; return f => { if (f !== lf || f.size !== ls) { lr = fn(f); lf = f; ls = f.size; } return lr; }; };

  // "All cells of one kind connect": kind(id, f) is 'in' (must connect), 'out', or '?'.
  // forcedVal is the value that keeps an undecided cell in the area.
  function connectRule(g, kind, vOf, forcedVal) {
    const scan = memo(f => {
      const k = Array.from({ length: g.n }, (_, id) => kind(id, f)), ins = []; for (let id = 0; id < g.n; id++) if (k[id] === 'in') ins.push(id);
      const split = skip => {
        if (ins.length < 2) return false;
        const seen = new Set([ins[0]]), q = [ins[0]];
        while (q.length) { const x = q.pop(); for (const y of g.nb4(x)) if (y !== skip && !seen.has(y) && k[y] !== 'out') { seen.add(y); q.push(y); } }
        return ins.some(x => !seen.has(x));
      };
      if (split(-1)) return { broken: true, forced: [] };
      const forced = [];
      if (ins.length >= 2) for (let id = 0; id < g.n; id++) if (k[id] === '?' && split(id)) forced.push([vOf(id), forcedVal]);
      return { broken: false, forced };
    });
    return { k: 'fn', vars: null, broken: f => scan(f).broken, forced: f => scan(f).forced };
  }

  // ---------- Nurikabe ----------
  LG.games.nurikabe = {
    id: 'nurikabe', title: 'Nurikabe', blurb: 'Shade cells black to leave islands of the right sizes.',
    rules: [
      'Every cell is black or white. Numbered cells are white.',
      'White cells form islands. Every island holds exactly one number, and its size is that number.',
      'All black cells form one connected area.',
      'No 2 by 2 block may be all black.',
    ],
    demo: { id: 'demo', title: 'Demo', grid: [[2, 0, 0], [0, 0, 0], [0, 0, 1]] },
    create(def) {
      const rows = def.grid, h = rows.length, w = rows[0].length, g = LG.grid(w, h), B = LG.builder();
      const num = id => rows[Math.floor(id / w)][id % w], vOf = new Array(g.n).fill(-1), cells = [];
      for (let id = 0; id < g.n; id++) if (!num(id)) { vOf[id] = cells.length; cells.push(id); }
      const st = (id, f) => { if (num(id)) return 'W'; const x = f.get(vOf[id]); return !x ? '?' : x.val ? 'B' : 'W'; };
      const islands = memo(f => {
        const s = Array.from({ length: g.n }, (_, id) => st(id, f)), out = { broken: false, forced: [] }, add = (id, val) => out.forced.push([vOf[id], val]);
        const { comp, groups } = LG.components(g, id => s[id] === 'W');
        const info = groups.map(grp => { const nums = grp.filter(num); return { grp, nums, n: nums.length === 1 ? num(nums[0]) : 0, libs: [...new Set(grp.flatMap(x => g.nb4(x)).filter(y => s[y] === '?'))] }; });
        for (const c of info) {
          if (c.nums.length > 1 || (c.n && c.grp.length > c.n)) return { broken: true, forced: [] };
          const full = c.n && c.grp.length === c.n;
          if (full) c.libs.forEach(y => add(y, 1));
          else if (!c.libs.length) return { broken: true, forced: [] };
          else if (c.libs.length === 1) add(c.libs[0], 0);
        }
        // A cell that would join two numbers, or make an island too big, is black.
        for (let id = 0; id < g.n; id++) {
          if (s[id] !== '?') continue;
          const near = [...new Set(g.nb4(id).filter(y => s[y] === 'W').map(y => comp[y]))].map(i => info[i]);
          const numbered = near.filter(c => c.n);
          if (numbered.length > 1 || (numbered.length === 1 && 1 + near.reduce((a, c) => a + c.grp.length, 0) > numbered[0].n)) add(id, 1);
        }
        // What each numbered island could still take in. An undecided cell costs 1 of the island's
        // remaining size. Joining a white group that has no number costs that group's whole size.
        // `blocked` is a cell treated as black, to ask "what if this cell were black?".
        const reachAll = blocked => {
          const reach = new Set(); let short = false;
          info.forEach((c, ci) => {
            if (!c.n) return;
            const budget = c.n - c.grp.length, cost = new Map(), q = c.grp.slice();
            c.grp.forEach(x => cost.set(x, 0));
            while (q.length) {
              const x = q.shift(), cx = cost.get(x);
              for (const y of g.nb4(x)) {
                if (y === blocked || s[y] === 'B' || (s[y] === 'W' && info[comp[y]].n)) continue;
                if (g.nb4(y).some(z => s[z] === 'W' && comp[z] !== ci && info[comp[z]].n)) continue;   // would join another number
                const ny = cx + (s[y] === '?' ? 1 : s[x] === 'W' && comp[x] === comp[y] ? 0 : info[comp[y]].grp.length);
                if (ny <= budget && (!cost.has(y) || ny < cost.get(y))) { cost.set(y, ny); q.push(y); }
              }
            }
            if (cost.size < c.n) short = true;      // not enough room left to reach its size
            cost.forEach((_, x) => reach.add(x));
          });
          return { reach, short };
        };
        const R = reachAll(-1);
        if (R.short) return { broken: true, forced: [] };
        // A cell no numbered island can reach is black.
        for (let id = 0; id < g.n; id++) {
          if (R.reach.has(id)) continue;
          if (s[id] === '?') add(id, 1); else if (s[id] === 'W') return { broken: true, forced: [] };
        }
        // A cell is white if making it black would leave an island short of its size, or would cut a
        // numberless white group off from every number. This is the "only one path" argument.
        const lonely = info.filter(c => !c.n);
        for (let id = 0; id < g.n; id++) {
          if (s[id] !== '?' || !R.reach.has(id)) continue;
          const r2 = reachAll(id);
          if (r2.short || lonely.some(c => !r2.reach.has(c.grp[0]))) add(id, 0);
        }
        return out;
      });
      const isl = B.con({ k: 'fn', vars: null, broken: f => islands(f).broken, forced: f => islands(f).forced });
      const conn = B.con(connectRule(g, (id, f) => ({ B: 'in', W: 'out', '?': '?' }[st(id, f)]), id => vOf[id], 1));
      B.anchor('isl', { text: 'the island rule', rule: 'Every island of white cells holds exactly one number, and its size is that number.', kind: 'island', brokenText: 'an island can no longer come out right' }).cons.push(isl);
      B.anchor('conn', { text: 'the black cells connect', rule: 'All black cells form one connected area.', kind: 'connect', brokenText: 'the black cells are cut apart' }).cons.push(conn);
      const blocks = Array.from({ length: g.n }, () => []);
      for (let r = 0; r + 1 < h; r++) for (let c = 0; c + 1 < w; c++) {
        const q = [g.id(r, c), g.id(r, c + 1), g.id(r + 1, c), g.id(r + 1, c + 1)];
        if (q.some(num)) continue;
        const i = B.lin(q.map(x => vOf[x]), 0, 3); q.forEach(x => blocks[x].push({ i, q }));
      }
      for (let id = 0; id < g.n; id++) if (blocks[id].length) {
        const a = B.anchor('q' + id, { text: 'no black 2 by 2 block at ' + g.cn(id), rule: 'No 2 by 2 block may be all black.', cells: [...new Set(blocks[id].flatMap(b => b.q))], at: { t: 'cell', id }, kind: 'block', brokenText: 'a 2 by 2 block at ' + g.cn(id) + ' is all black' });
        blocks[id].forEach(b => a.cons.push(b.i));
      }
      return base(B, {
        nvars: cells.length, tools: ['Black', 'White'],
        howToCite: 'Click a number or a white cell for the island rule. Click a black cell for the two rules about black cells: they all connect, and no 2 by 2 block is all black.',
        name: (v, val) => ({ who: g.cn(cells[v]), one: val ? 'is black' : 'is white', many: val ? 'are black' : 'are white' }),
        cellOf: v => cells[v],
        check(f) {
          const s = Array.from({ length: g.n }, (_, id) => st(id, f));
          if (LG.components(g, id => s[id] === 'B').groups.length > 1) return false;
          return LG.components(g, id => s[id] === 'W').groups.every(grp => { const nums = grp.filter(num); return nums.length === 1 && num(nums[0]) === grp.length; });
        },
        // The island rule is cited from a white cell, the two rules about black cells from a black cell.
        anchorsAt(t, f) {
          if (t.t !== 'cell') return [];
          const s = st(t.id, f);
          return s === 'W' ? ['isl'] : s === 'B' ? ['conn'].concat(blocks[t.id].length ? ['q' + t.id] : []) : [];
        },
        noAnchor: () => 'An undecided cell has no rule yet. Click a number or a white cell for the island rule, or a black cell for the rules about black cells.',
        markOf: (t, tool) => (t.t === 'cell' && vOf[t.id] >= 0 ? { v: vOf[t.id], val: tool === 0 ? 1 : 0 } : null),
        view: { w, h, cell(id, f) { if (num(id)) return { text: num(id), textCls: 'given' }; const x = f.get(vOf[id]); return !x ? { bg: 'unknown' } : x.val ? { bg: 'black', src: x } : { icon: 'dot', src: x }; } },
      });
    },
  };

  // ---------- Heyawake ----------
  LG.games.heyawake = {
    id: 'heyawake', title: 'Heyawake', blurb: 'Shade cells black room by room.',
    rules: [
      'Every cell is black or white.',
      'A room with a number holds exactly that many black cells.',
      'A straight line of white cells may not pass through two room borders. It may touch at most two rooms.',
      'All white cells form one connected area.',
      'Black cells may not share a side. The game applies this rule for you: the cells beside a black cell are marked white.',
    ],
    demo: { id: 'demo', title: 'Demo', regions: ['AAB', 'CCB', 'CCD'], nums: { A: 1, B: 0, C: 1, D: 0 } },
    create(def) {
      const rows = def.regions, h = rows.length, w = rows[0].length, g = LG.grid(w, h), B = LG.builder();
      const room = id => rows[Math.floor(id / w)][id % w], rooms = {};
      for (let id = 0; id < g.n; id++) (rooms[room(id)] = rooms[room(id)] || []).push(id);
      const labelAt = {};
      for (const [k, cells] of Object.entries(rooms)) {
        const n = (def.nums || {})[k]; if (n == null) continue;
        labelAt[cells[0]] = n;
        B.anchor('g' + k, { text: 'the ' + n + ' in the room at ' + g.cn(cells[0]), rule: 'This room holds exactly ' + n + ' black ' + (n === 1 ? 'cell.' : 'cells.'), cells, count: 'cells', at: { t: 'cell', id: cells[0] }, kind: 'room' }).cons.push(B.lin(cells, n, n));
      }
      // Shortest stretches that cross two borders: the last cell of one room, all of the next, the first of a third.
      const wins = Array.from({ length: g.n }, () => []);
      const lines = []; for (let r = 0; r < h; r++) lines.push(g.row(r)); for (let c = 0; c < w; c++) lines.push(g.col(c));
      for (const line of lines) {
        const cuts = []; for (let i = 0; i + 1 < line.length; i++) if (room(line[i]) !== room(line[i + 1])) cuts.push(i);
        for (let j = 0; j + 1 < cuts.length; j++) { const win = line.slice(cuts[j], cuts[j + 1] + 2), i = B.lin(win, 1, 99); win.forEach(c => wins[c].push({ i, win })); }
      }
      for (let id = 0; id < g.n; id++) if (wins[id].length) {
        const a = B.anchor('l' + id, { text: 'no long white line through ' + g.cn(id), rule: 'A straight line of white cells may not pass through two room borders, so each outlined stretch needs a black cell.', cells: [...new Set(wins[id].flatMap(x => x.win))], count: 'cells', at: { t: 'cell', id }, kind: 'line', brokenText: 'a white line through ' + g.cn(id) + ' crosses two room borders' });
        wins[id].forEach(x => a.cons.push(x.i));
      }
      const st = (id, f) => { const x = f.get(id); return !x ? '?' : x.val ? 'out' : 'in'; };
      B.anchor('conn', { text: 'the white cells connect', rule: 'All white cells form one connected area.', kind: 'connect', brokenText: 'the white cells are cut apart' }).cons.push(B.con(connectRule(g, st, id => id, 0)));
      const touch = {};
      for (let id = 0; id < g.n; id++) for (const y of g.nb4(id)) if (y > id) B.apart(id, y, id, y, touch);
      for (let id = 0; id < g.n; id++) B.anchor('n' + id, { text: 'black cells may not share a side (the black cell at ' + g.cn(id) + ')', rule: 'Black cells may not share a side, so the outlined cells beside this one are white.', cells: g.nb4(id), at: { t: 'cell', id }, kind: 'touch', info: true }).cons.push(...touch[id]);
      return base(B, {
        nvars: g.n, tools: ['Black', 'White'],
        howToCite: 'Click a cell for its room number. Click it again for the white line rule, and on a white cell once more for the connection rule.',
        name: (v, val) => ({ who: g.cn(v), one: val ? 'is black' : 'is white', many: val ? 'are black' : 'are white' }),
        cellOf: v => v,
        check: f => LG.components(g, id => !f.get(id).val).groups.length <= 1,
        // Every cell gives its room number. The rules about white cells are cited from a cell that is not black.
        anchorsAt(t, f) {
          if (t.t !== 'cell') return [];
          const k = [], x = f && f.get(t.id), black = x && x.val, white = x && !x.val;
          if (black) k.push('n' + t.id);
          if (B.anchors['g' + room(t.id)]) k.push('g' + room(t.id));
          if (!black && wins[t.id].length) k.push('l' + t.id);
          if (white) k.push('conn');
          return k;
        },
        markOf: (t, tool) => (t.t === 'cell' ? { v: t.id, val: tool === 0 ? 1 : 0 } : null),
        view: { w, h, regions: Array.from({ length: g.n }, (_, id) => room(id)), cell(id, f) { const x = f.get(id), t = labelAt[id]; return !x ? { bg: 'unknown', text: t, small: true } : x.val ? { bg: 'black', text: t, small: true, textCls: 'walltext', src: x } : { text: t, small: true, src: x }; } },
      });
    },
  };

  // ---------- Battleship ----------
  const fleetText = fleet => { const c = {}; fleet.forEach(n => { c[n] = (c[n] || 0) + 1; }); return Object.keys(c).sort((a, b) => b - a).map(n => c[n] + ' of length ' + n).join(', '); };
  LG.games.battleship = {
    id: 'battleship', title: 'Battleship', blurb: 'Find the hidden fleet from the row and column counts.',
    rules: [
      'Every cell is part of a ship or is water.',
      'The number beside a row or below a column says how many of its cells are ship.',
      'Ships are straight lines of cells. The fleet for each puzzle is listed under the board.',
      'Ships may not touch, not even diagonally. The game applies the diagonal part for you: the cells diagonal to a ship cell are marked water.',
    ],
    demo: { id: 'demo', title: 'Demo', w: 4, h: 4, rows: [2, 0, 1, 1], cols: [1, 1, 0, 2], fleet: [2, 1, 1], given: [] },
    create(def) {
      const w = def.w, h = def.h, g = LG.grid(w, h), B = LG.builder(), fleet = def.fleet.slice().sort((a, b) => b - a), maxL = fleet[0], needL = {};
      fleet.forEach(n => { needL[n] = (needL[n] || 0) + 1; });
      const count = (key, label, cells, k, at) => B.anchor(key, { text: 'the ' + k + ' for ' + label, rule: 'Exactly ' + k + ' of the outlined cells ' + (k === 1 ? 'is' : 'are') + ' ship.', cells, count: 'cells', at, kind: 'count' }).cons.push(B.lin(cells, k, k));
      for (let r = 0; r < h; r++) count('r' + r, 'row ' + (r + 1), g.row(r), def.rows[r], { t: 'clue', side: 'e', i: r });
      for (let c = 0; c < w; c++) count('k' + c, 'column ' + String.fromCharCode(65 + c), g.col(c), def.cols[c], { t: 'clue', side: 's', i: c });
      const scan = memo(f => {
        const s = id => { const x = f.get(id); return !x ? '?' : x.val ? 'S' : 'W'; };
        const { comp, groups } = LG.components(g, id => s(id) === 'S'), done = {}, out = { broken: false, forced: [] };
        const ends = grp => [...new Set(grp.flatMap(x => g.nb4(x)).filter(y => s(y) === '?'))];
        const open = groups.map(grp => ends(grp));
        groups.forEach((grp, i) => { if (!open[i].length) done[grp.length] = (done[grp.length] || 0) + 1; });
        for (const L in done) if (done[L] > (needL[L] || 0)) return { broken: true, forced: [] };
        const fits = len => { for (let L = len; L <= maxL; L++) if ((needL[L] || 0) - (done[L] || 0) > 0) return true; return false; };
        for (let i = 0; i < groups.length; i++) {
          if (!open[i].length) continue;
          const len = groups[i].length;
          if (len > maxL || !fits(len)) return { broken: true, forced: [] };
          if (!fits(len + 1)) open[i].forEach(y => out.forced.push([y, 0]));       // this ship cannot grow
        }
        for (let id = 0; id < g.n; id++) {
          if (s(id) !== '?') continue;
          const [r, c] = g.rc(id), len = (a, b) => { let n = 1; for (const y of [a, b]) if (y !== null && s(y) === 'S') n += groups[comp[y]].length; return n; };
          const L = c > 0 ? id - 1 : null, R = c + 1 < w ? id + 1 : null, U = r > 0 ? id - w : null, D = r + 1 < h ? id + w : null;
          if (!fits(Math.max(len(L, R), len(U, D)))) out.forced.push([id, 0]);
        }
        return out;
      });
      B.anchor('fleet', { text: 'the fleet', rule: 'The ships are ' + fleetText(fleet) + '. Each is a straight line, and no two touch.', kind: 'fleet', brokenText: 'the ships no longer match the fleet' })
        .cons.push(B.con({ k: 'fn', vars: null, broken: f => scan(f).broken, forced: f => scan(f).forced }));
      const touch = {};
      for (let r = 0; r + 1 < h; r++) for (let c = 0; c < w; c++) for (const dc of [-1, 1]) if (c + dc >= 0 && c + dc < w) B.apart(g.id(r, c), g.id(r + 1, c + dc), g.id(r, c), g.id(r + 1, c + dc), touch);
      const diag = id => g.nb8(id).filter(y => !g.nb4(id).includes(y));
      for (let id = 0; id < g.n; id++) if (touch[id]) B.anchor('n' + id, { text: 'ships may not touch diagonally (the ship cell at ' + g.cn(id) + ')', rule: 'Ships may not touch, not even diagonally, so the outlined cells diagonal to this ship cell are water.', cells: diag(id), at: { t: 'cell', id }, kind: 'touch', info: true }).cons.push(...touch[id]);
      return base(B, {
        nvars: g.n, givens: def.given || [], tools: ['Ship', 'Water'],
        howToCite: 'Fleet: ' + fleetText(fleet) + '. Click the number beside a row or below a column for its count. Click a cell for the fleet rule.',
        name: (v, val) => ({ who: g.cn(v), one: val ? 'is ship' : 'is water', many: val ? 'are ship' : 'are water' }),
        cellOf: v => v,
        check(f) { const lens = LG.components(g, id => f.get(id).val === 1).groups.map(x => x.length).sort((a, b) => b - a); return lens.length === fleet.length && lens.every((n, i) => n === fleet[i]); },
        anchorsAt(t, f) {
          if (t.t === 'cell') { const [r, c] = g.rc(t.id), x = f && f.get(t.id); return (x && x.val && B.anchors['n' + t.id] ? ['n' + t.id] : []).concat(['fleet']); }
          if (t.t === 'clue') return [(t.side === 'e' ? 'r' : 'k') + t.i];
          return t.t === 'row' ? ['r' + t.i] : t.t === 'col' ? ['k' + t.i] : [];
        },
        markOf: (t, tool) => (t.t === 'cell' ? { v: t.id, val: tool === 0 ? 1 : 0 } : null),
        view: { w, h, clues: { e: def.rows, s: def.cols }, cell(id, f) { const x = f.get(id); return !x ? {} : x.val ? { bg: 'water', icon: 'ship', src: x } : { bg: 'water', src: x }; } },
      });
    },
  };
})();
