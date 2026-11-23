// Games with one number per cell: Sudoku and Skyscrapers.
// Variable (cell, d) means "this cell holds d + 1".
(function () {
  'use strict';
  const LG = window.LG;
  // Shared part: every cell holds one number, and each line holds each number once.
  function latin(n, B, g, what) {
    const X = (id, d) => id * n + d, D = Array.from({ length: n }, (_, d) => d);
    for (let id = 0; id < g.n; id++)
      B.anchor('c' + id, { text: g.cn(id) + ' holds one ' + what, rule: g.cn(id) + ' holds exactly one ' + what + '. The small numbers show what is still possible.', cells: [id], count: 'numbers', at: { t: 'cell', id }, kind: 'cell', how: 'Click the cell again to fill it in, if only one number is left.', brokenText: 'nothing can go in ' + g.cn(id) })
        .cons.push(B.lin(D.map(d => X(id, d)), 1, 1, { auto: 'hi' }));
    const unit = (key, text, rule, cells, at, kind) => { const a = B.anchor(key, { text, rule, cells, count: 'cells', at, kind }); D.forEach(d => a.cons.push(B.lin(cells.map(id => X(id, d)), 1, 1, { auto: 'hi' }))); };
    for (let r = 0; r < n; r++) unit('r' + r, 'row ' + (r + 1) + ' holds every ' + what + ' once', 'Row ' + (r + 1) + ' holds each ' + what + ' exactly once.', g.row(r), { t: 'row', i: r }, 'row');
    for (let c = 0; c < n; c++) { const L = String.fromCharCode(65 + c); unit('k' + c, 'column ' + L + ' holds every ' + what + ' once', 'Column ' + L + ' holds each ' + what + ' exactly once.', g.col(c), { t: 'col', i: c }, 'column'); }
    return { X, D, unit };
  }
  function common(n, g, B, X, extra) {
    return Object.assign({
      nvars: g.n * n, cons: B.cons, anchor: k => B.anchors[k], anchorKeys: B.anchorKeys, digits: n,
      name: (v, val) => { const d = v % n + 1; return { who: g.cn(Math.floor(v / n)), one: val ? 'is ' + d : 'is not ' + d, many: val ? 'are ' + d : 'are not ' + d }; },
      cellOf: v => Math.floor(v / n),
      markOf(t, tool, right, key, f) {
        if (t.t !== 'cell') return null;
        if (key === 'c' + t.id) { const open = []; for (let d = 0; d < n; d++) if (!f.has(X(t.id, d))) open.push(d); if (open.length === 1) return { v: X(t.id, open[0]), val: 1 }; }
        return { v: X(t.id, tool), val: right ? 0 : 1 };
      },
      splitOf: t => (t.t === 'cell' ? { anchor: 'c' + t.id } : null),
    }, extra);
  }
  const cellView = (n, X) => (id, f) => {
    const cands = [];
    for (let d = 0; d < n; d++) { const x = f.get(X(id, d)); if (x && x.val) return { text: d + 1, textCls: x.given ? 'given' : 'val', src: x }; if (!x) cands.push(d + 1); }
    return { cands, n };
  };

  // ---------- Sudoku ----------
  LG.games.sudoku = {
    id: 'sudoku', title: 'Sudoku', blurb: 'Fill the grid so every row, column and box holds each digit once.',
    rules: [
      'Every cell holds one digit.',
      'Every row, every column and every outlined box holds each digit exactly once.',
      'The game crosses out digits for you: when a digit is placed, it disappears from the small numbers in the same row, column and box.',
    ],
    demo: { id: 'demo', title: 'Demo', grid: ['1...', '..1.', '.1..', '...1'] },
    create(def) {
      const n = def.grid.length, g = LG.grid(n, n), B = LG.builder(), L = latin(n, B, g, 'digit'), X = L.X;
      const bh = n === 6 ? 2 : Math.round(Math.sqrt(n)), bw = n / bh, box = id => Math.floor(Math.floor(id / n) / bh) * bh + Math.floor((id % n) / bw);
      for (let b = 0; b < n; b++) { const cells = []; for (let id = 0; id < g.n; id++) if (box(id) === b) cells.push(id); L.unit('b' + b, 'the box at ' + g.cn(cells[0]) + ' holds every digit once', 'This box holds each digit exactly once.', cells, null, 'box'); }
      const givens = [];
      for (let id = 0; id < g.n; id++) { const ch = def.grid[Math.floor(id / n)][id % n]; if (ch >= '1' && ch <= '9') givens.push([X(id, +ch - 1), 1]); }
      return common(n, g, B, X, {
        givens, howToCite: 'Click a cell, a row number or a column letter. Click a cell again to move on to its box, row and column.',
        anchorsAt(t) { if (t.t === 'cell') { const r = Math.floor(t.id / n), c = t.id % n; return ['c' + t.id, 'b' + box(t.id), 'r' + r, 'k' + c]; } return t.t === 'row' ? ['r' + t.i] : t.t === 'col' ? ['k' + t.i] : []; },
        view: { w: n, h: n, regions: Array.from({ length: g.n }, (_, id) => box(id)), cell: cellView(n, X) },
      });
    },
  };

  // ---------- Skyscrapers ----------
  const perms = {};
  const allPerms = n => perms[n] || (perms[n] = (function rec(rest) { if (!rest.length) return [[]]; const o = []; rest.forEach((x, i) => rec(rest.filter((_, j) => j !== i)).forEach(p => o.push([x, ...p]))); return o; })(Array.from({ length: n }, (_, i) => i)));
  const seen = p => { let top = -1, k = 0; for (const x of p) if (x > top) { top = x; k++; } return k; };
  LG.games.skyscrapers = {
    id: 'skyscrapers', title: 'Skyscrapers', blurb: 'Place buildings so the right number can be seen from each side.',
    rules: [
      'Every cell holds a building. Its number is its height.',
      'Every row and every column holds each height exactly once.',
      'A number outside the grid says how many buildings you can see from there, looking along that row or column. A taller building hides every shorter one behind it.',
      'The game crosses out heights for you: when a height is placed, it disappears from the small numbers in the same row and column.',
    ],
    demo: { id: 'demo', title: 'Demo', n: 3, clues: { n: [3, null, null], s: [null, null, null], w: [null, 1, null], e: [null, null, 2] } },
    create(def) {
      const n = def.n, g = LG.grid(n, n), B = LG.builder(), L = latin(n, B, g, 'height'), X = L.X, P = allPerms(n);
      const view = (line, k) => {
        const memo = new Map();
        const calc = f => {
          const masks = line.map(id => { let m = 0; for (let d = 0; d < n; d++) { const x = f.get(X(id, d)); if (x && x.val) return 1 << d; if (!x) m |= 1 << d; } return m; });
          const key = masks.join(',');
          if (memo.has(key)) return memo.get(key);
          const used = line.map(() => 0); let any = false;
          for (const p of P) if (p.every((d, i) => masks[i] >> d & 1) && seen(p) === k) { any = true; p.forEach((d, i) => { used[i] |= 1 << d; }); }
          const res = { any, used }; memo.set(key, res); return res;
        };
        return {
          k: 'fn', vars: line.flatMap(id => L.D.map(d => X(id, d))),
          broken: f => !calc(f).any,
          forced(f) {
            const r = calc(f), out = []; if (!r.any) return out;
            line.forEach((id, i) => { const u = r.used[i], single = (u & (u - 1)) === 0; for (let d = 0; d < n; d++) { const v = X(id, d); if (f.has(v)) continue; if (!(u >> d & 1)) out.push([v, 0]); else if (single) out.push([v, 1]); } });
            return out;
          },
        };
      };
      const sides = { n: i => g.col(i), s: i => g.col(i).reverse(), w: i => g.row(i), e: i => g.row(i).reverse() }, names = { n: 'above column ', s: 'below column ', w: 'left of row ', e: 'right of row ' };
      for (const side of ['n', 'w', 'e', 's']) (def.clues[side] || []).forEach((k, i) => {
        if (k == null || k <= 0) return;
        const line = sides[side](i), label = names[side] + (side === 'n' || side === 's' ? String.fromCharCode(65 + i) : i + 1);
        B.anchor(side + i, { text: 'the ' + k + ' ' + label, rule: 'From this side you see exactly ' + k + (k === 1 ? ' building' : ' buildings') + ' along the outlined line.', cells: line, at: { t: 'clue', side, i }, kind: 'view', how: 'Set a height this forces, or right-click to rule a height out.' }).cons.push(B.con(view(line, k)));
      });
      const givens = (def.given || []).map(([v, x, y]) => [X(g.id(y, x), v - 1), 1]);
      const cl = {}; for (const side of ['n', 's', 'e', 'w']) if ((def.clues[side] || []).some(k => k != null && k > 0)) cl[side] = def.clues[side].map(k => (k != null && k > 0 ? k : null));
      return common(n, g, B, X, {
        givens, howToCite: 'Click a number outside the grid, a cell, a row number or a column letter.',
        anchorsAt(t) { if (t.t === 'cell') { const r = Math.floor(t.id / n), c = t.id % n; return ['c' + t.id, 'r' + r, 'k' + c]; } if (t.t === 'clue') return B.anchors[t.side + t.i] ? [t.side + t.i] : []; return t.t === 'row' ? ['r' + t.i] : t.t === 'col' ? ['k' + t.i] : []; },
        view: { w: n, h: n, clues: cl, cell: cellView(n, X) },
      });
    },
  };
})();
