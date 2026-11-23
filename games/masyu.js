// Masyu. Variables are the links between neighbouring cells: on the loop or not.
(function () {
  'use strict';
  const LG = window.LG;
  LG.games.masyu = {
    id: 'masyu', title: 'Masyu', blurb: 'Draw one loop through every circle.',
    rules: [
      'Draw a single closed loop that runs from cell centre to cell centre, up, down, left or right. It never crosses or branches.',
      'The loop passes through every circle.',
      'On a white circle the loop goes straight, and it turns in the cell just before or just after the circle.',
      'On a black circle the loop turns, and it goes straight through the next cell on both sides.',
      'Click between two cells to mark the link between them. The game applies one rule for you: once a cell has two links, its other links are ruled out.',
    ],
    demo: { id: 'demo', title: 'Demo', grid: ['B..', '...', '..W'] },
    create(def) {
      const rows = def.grid, h = rows.length, w = rows[0].length, g = LG.grid(w, h), B = LG.builder();
      const kind = id => rows[Math.floor(id / w)][id % w], edges = [], ev = {};
      const E = (a, b) => ev[Math.min(a, b) + ',' + Math.max(a, b)];
      for (let id = 0; id < g.n; id++) { const [r, c] = g.rc(id); if (c + 1 < w) { ev[id + ',' + (id + 1)] = edges.length; edges.push({ a: id, b: id + 1, v: edges.length }); } if (r + 1 < h) { ev[id + ',' + (id + w)] = edges.length; edges.push({ a: id, b: id + w, v: edges.length }); } }
      const step = (id, d) => { const [r, c] = g.rc(id), nr = r + d[0], nc = c + d[1]; return g.inside(nr, nc) ? g.id(nr, nc) : null; };
      const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (let id = 0; id < g.n; id++) {
        const nb = DIRS.map(d => step(id, d)), e = nb.map(y => (y === null ? null : E(id, y))), own = e.filter(x => x !== null);
        const far = DIRS.map((d, i) => (nb[i] === null || step(nb[i], d) === null ? null : E(nb[i], step(nb[i], d))));   // the link one cell further on
        const pat = on => own.map(x => [x, on.includes(x) ? 1 : 0]), pats = [];
        if (kind(id) === 'W') {
          for (const [i, j] of [[0, 1], [2, 3]]) {
            if (e[i] === null || e[j] === null) continue;
            const b = pat([e[i], e[j]]);
            if (far[i] === null || far[j] === null) pats.push(b); else { pats.push(b.concat([[far[i], 0]])); pats.push(b.concat([[far[j], 0]])); }
          }
        } else if (kind(id) === 'B') {
          for (const i of [0, 1]) for (const j of [2, 3]) if (e[i] !== null && e[j] !== null && far[i] !== null && far[j] !== null) pats.push(pat([e[i], e[j]]).concat([[far[i], 1], [far[j], 1]]));
        } else {
          pats.push(pat([]));
          for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (e[i] !== null && e[j] !== null) pats.push(pat([e[i], e[j]]));
        }
        const what = kind(id) === 'W' ? 'the white circle at ' : kind(id) === 'B' ? 'the black circle at ' : 'the path at ';
        const rule = kind(id) === 'W' ? 'The loop goes straight through this white circle and turns in the cell just before or just after it.'
          : kind(id) === 'B' ? 'The loop turns on this black circle and goes straight through the next cell on both sides.'
          : 'The loop uses two of the links of this cell, or none.';
        B.anchor('c' + id, { text: what + g.cn(id), rule, cells: [id], at: { t: 'cell', id }, kind: kind(id) === 'W' ? 'white' : kind(id) === 'B' ? 'black' : 'cell', how: 'Click between two cells to mark a link this rule forces.' })
          .cons.push(B.con({ k: 'pat', pats }));
        B.lin(own, 0, 2, { auto: 'hi' });
      }
      const pearls = []; for (let id = 0; id < g.n; id++) if (kind(id) !== '.') pearls.push(id);
      // Follow the links that are on: groups of joined cells, and whether a group is a closed ring.
      const shape = f => {
        const deg = new Array(g.n).fill(0), par = Array.from({ length: g.n }, (_, i) => i), find = x => (par[x] === x ? x : (par[x] = find(par[x])));
        let on = 0;
        for (const e of edges) { const x = f.get(e.v); if (x && x.val) { deg[e.a]++; deg[e.b]++; par[find(e.a)] = find(e.b); on++; } }
        return { deg, find, on };
      };
      const ringOf = (S, root) => { let n = 0; for (let id = 0; id < g.n; id++) if (S.deg[id] && S.find(id) === root) { if (S.deg[id] !== 2) return 0; n++; } return n; };   // cells in a ring == links in it
      B.anchor('loop', { text: 'the single loop rule', rule: 'The path is one closed loop. It may not close while a circle or another piece of path is left out.', kind: 'loop', how: 'Mark a link that would close the loop too early as off.', brokenText: 'the loop closed and left something out' })
        .cons.push(B.con({
          k: 'fn', vars: null,
          broken(f) { const S = shape(f); for (let id = 0; id < g.n; id++) if (S.deg[id] === 2 && S.find(id) === id) { const n = ringOf(S, id); if (n && (n !== S.on || pearls.some(p => S.find(p) !== id))) return true; } return false; },
          forced(f) {
            const S = shape(f), out = [];
            for (const e of edges) {
              if (f.has(e.v) || S.deg[e.a] !== 1 || S.deg[e.b] !== 1 || S.find(e.a) !== S.find(e.b)) continue;
              const root = S.find(e.a); let size = 0; for (let id = 0; id < g.n; id++) if (S.deg[id] && S.find(id) === root) size++;
              if (size - 1 !== S.on || pearls.some(p => S.find(p) !== root)) out.push([e.v, 0]);     // closing now would leave something out
            }
            return out;
          },
        }));
      return {
        nvars: edges.length, cons: B.cons, anchor: k => B.anchors[k], anchorKeys: B.anchorKeys, tools: ['Line', 'No line'],
        need: [], solveVars: edges.map(e => e.v),
        howToCite: 'Click a cell to cite its rule. Click it again for the single loop rule. Then click between two cells to mark a link.',
        name: (v, val) => ({ who: g.cn(edges[v].a) + '-' + g.cn(edges[v].b), one: val ? 'is joined' : 'is not joined', many: val ? 'are joined' : 'are not joined' }),
        cellOf: v => [edges[v].a, edges[v].b],
        check(f) { const S = shape(f); if (!S.on || S.deg.some(d => d !== 0 && d !== 2)) return false; const root = S.find(edges.find(e => f.get(e.v) && f.get(e.v).val).a); return ringOf(S, root) === S.on && pearls.every(p => S.deg[p] === 2 && S.find(p) === root); },
        anchorsAt: t => (t.t === 'cell' ? ['c' + t.id, 'loop'] : []),
        noAnchor: () => 'Click a cell to cite its rule first.',
        markOf: (t, tool) => (t.t === 'edge' ? { v: t.v, val: tool === 0 ? 1 : 0 } : null),
        view: { w, h, edges, cell(id) { return kind(id) === 'W' ? { icon: 'pearlW' } : kind(id) === 'B' ? { icon: 'pearlB' } : {}; } },
      };
    },
  };
})();
