// Games whose rules are counts over sets of cells:
// Fillapix, Minesweeper, Binary, Star Battle, Thermometer.
(function () {
  'use strict';
  const LG = window.LG;
  const base = (B, extra) => Object.assign({ cons: B.cons, anchor: k => B.anchors[k], anchorKeys: B.anchorKeys }, extra);
  const parse = rows => { const h = rows.length, w = rows[0].length; return { h, w, g: LG.grid(w, h), ch: id => rows[Math.floor(id / w)][id % w] }; };
  const isDigit = c => c >= '0' && c <= '9';

  // ---------- Fillapix ----------
  LG.games.fillapix = {
    id: 'fillapix', title: 'Fillapix', blurb: 'Colour cells black so every number counts the black cells around it.',
    rules: [
      'Every cell is black or white.',
      'A number says how many cells are black in the 3 by 3 block centred on it. The block includes the numbered cell itself.',
    ],
    demo: { id: 'demo', title: 'Demo', grid: ['0..', '.5.', '..4'] },
    create(def) {
      const { h, w, g, ch } = parse(def.grid), B = LG.builder();
      for (let id = 0; id < g.n; id++) {
        if (!isDigit(ch(id))) continue;
        const k = +ch(id), blk = [id, ...g.nb8(id)].sort((a, b) => a - b);
        B.anchor('c' + id, { text: 'the ' + k + ' at ' + g.cn(id), rule: 'Exactly ' + k + ' of the outlined cells ' + (k === 1 ? 'is' : 'are') + ' black.', cells: blk, count: 'cells', at: { t: 'cell', id }, kind: 'number' })
          .cons.push(B.lin(blk, k, k));
      }
      return base(B, {
        nvars: g.n, tools: ['Black', 'White'], howToCite: 'Click a number to cite it as your reason.',
        name: (v, val) => ({ who: g.cn(v), one: val ? 'is black' : 'is white', many: val ? 'are black' : 'are white' }),
        cellOf: v => v,
        anchorsAt: t => (t.t === 'cell' && isDigit(ch(t.id)) ? ['c' + t.id] : []),
        noAnchor: () => 'Only numbered cells carry a rule.',
        markOf: (t, tool) => (t.t === 'cell' ? { v: t.id, val: tool === 0 ? 1 : 0 } : null),
        view: { w, h, cell(id, f) { const x = f.get(id), t = isDigit(ch(id)) ? ch(id) : null; return !x ? { bg: 'unknown', text: t } : x.val ? { bg: 'black', text: t, textCls: 'walltext', src: x } : { text: t, src: x }; } },
      });
    },
  };

  // ---------- Minesweeper ----------
  LG.games.minesweeper = {
    id: 'minesweeper', title: 'Minesweeper', blurb: 'Find every mine from the numbers.',
    rules: [
      'Every grey cell either hides a mine or is safe.',
      'A number says how many of the eight cells around it hide a mine.',
      'Numbered cells never hide a mine.',
    ],
    demo: { id: 'demo', title: 'Demo', grid: ['.2.', '.3.', '110'] },
    create(def) {
      const { h, w, g, ch } = parse(def.grid), B = LG.builder(), vOf = new Array(g.n).fill(-1), cells = [];
      for (let id = 0; id < g.n; id++) if (!isDigit(ch(id))) { vOf[id] = cells.length; cells.push(id); }
      for (let id = 0; id < g.n; id++) {
        if (!isDigit(ch(id))) continue;
        const k = +ch(id), nb = g.nb8(id).filter(x => vOf[x] >= 0);
        B.anchor('c' + id, { text: 'the ' + k + ' at ' + g.cn(id), rule: 'Exactly ' + k + ' of the outlined cells ' + (k === 1 ? 'hides a mine.' : 'hide mines.'), cells: nb, count: 'cells', at: { t: 'cell', id }, kind: 'number' })
          .cons.push(B.lin(nb.map(x => vOf[x]), k, k));
      }
      return base(B, {
        nvars: cells.length, tools: ['Mine', 'Safe'], howToCite: 'Click a number to cite it as your reason.',
        name: (v, val) => ({ who: g.cn(cells[v]), one: val ? 'is a mine' : 'is safe', many: val ? 'are mines' : 'are safe' }),
        cellOf: v => cells[v],
        anchorsAt: t => (t.t === 'cell' && isDigit(ch(t.id)) ? ['c' + t.id] : []),
        noAnchor: () => 'Only numbered cells carry a rule.',
        markOf: (t, tool) => (t.t === 'cell' && vOf[t.id] >= 0 ? { v: vOf[t.id], val: tool === 0 ? 1 : 0 } : null),
        view: { w, h, cell(id, f) { if (isDigit(ch(id))) return { text: ch(id) }; const x = f.get(vOf[id]); return !x ? { bg: 'unknown' } : x.val ? { bg: 'unknown', icon: 'mine', src: x } : { icon: 'dot', src: x }; } },
      });
    },
  };

  // ---------- Binary ----------
  LG.games.binary = {
    id: 'binary', title: 'Binary', blurb: 'Fill the grid with 0s and 1s.',
    rules: [
      'Every cell holds a 0 or a 1.',
      'No three cells next to each other in a row or column may hold the same digit.',
      'Every row and every column holds as many 0s as 1s.',
      'No two rows are the same, and no two columns are the same.',
    ],
    demo: { id: 'demo', title: 'Demo', grid: ['11..', '....', '.00.', '...1'] },
    create(def) {
      const { h, w, g, ch } = parse(def.grid), B = LG.builder(), givens = [];
      for (let id = 0; id < g.n; id++) if (ch(id) === '0' || ch(id) === '1') givens.push([id, +ch(id)]);
      const tri = Array.from({ length: g.n }, () => []);
      const addTri = cells => { const i = B.lin(cells, 1, 2); cells.forEach(c => tri[c].push({ i, cells })); };
      for (let r = 0; r < h; r++) for (let c = 0; c + 2 < w; c++) addTri([g.id(r, c), g.id(r, c + 1), g.id(r, c + 2)]);
      for (let c = 0; c < w; c++) for (let r = 0; r + 2 < h; r++) addTri([g.id(r, c), g.id(r + 1, c), g.id(r + 2, c)]);
      for (let id = 0; id < g.n; id++) {
        const a = B.anchor('t' + id, { text: 'no three alike near ' + g.cn(id), rule: 'No three cells next to each other in a line may hold the same digit.', cells: [...new Set(tri[id].flatMap(t => t.cells))], at: { t: 'cell', id }, kind: 'three', brokenText: 'three equal digits sit together near ' + g.cn(id) });
        tri[id].forEach(t => a.cons.push(t.i));
      }
      // Lines must differ: with one cell left, it must break the match with any finished twin.
      const differ = lines => ({
        k: 'fn', vars: lines.flat(),
        scan(f, hit) {
          for (let a = 0; a < lines.length; a++) for (let b = 0; b < lines.length; b++) {
            if (a === b || !lines[b].every(v => f.has(v))) continue;
            let open = -1, n = 0, same = true;
            lines[a].forEach((v, j) => { const x = f.get(v); if (!x) { open = j; n++; } else if (x.val !== f.get(lines[b][j]).val) same = false; });
            if (same && hit(a, b, n, open)) return true;
          }
          return false;
        },
        broken(f) { return this.scan(f, (a, b, n) => n === 0 && a < b); },
        forced(f) { const out = []; this.scan(f, (a, b, n, open) => { if (n === 1) out.push([lines[a][open], 1 - f.get(lines[b][open]).val]); return false; }); return out; },
      });
      const rowsL = Array.from({ length: h }, (_, r) => g.row(r)), colsL = Array.from({ length: w }, (_, c) => g.col(c));
      const dr = B.con(differ(rowsL)), dc = B.con(differ(colsL));
      for (let r = 0; r < h; r++) {
        B.anchor('r' + r, { text: 'row ' + (r + 1) + ' is balanced', rule: 'Row ' + (r + 1) + ' holds exactly ' + w / 2 + ' 1s and ' + w / 2 + ' 0s.', cells: g.row(r), count: 'cells', at: { t: 'row', i: r }, kind: 'balance' }).cons.push(B.lin(g.row(r), w / 2, w / 2));
        B.anchor('ur' + r, { text: 'rows differ (row ' + (r + 1) + ')', rule: 'No two rows are the same.', cells: g.row(r), at: { t: 'row', i: r }, kind: 'differ', brokenText: 'two rows are the same' }).cons.push(dr);
      }
      for (let c = 0; c < w; c++) {
        const L = String.fromCharCode(65 + c);
        B.anchor('k' + c, { text: 'column ' + L + ' is balanced', rule: 'Column ' + L + ' holds exactly ' + h / 2 + ' 1s and ' + h / 2 + ' 0s.', cells: g.col(c), count: 'cells', at: { t: 'col', i: c }, kind: 'balance' }).cons.push(B.lin(g.col(c), h / 2, h / 2));
        B.anchor('uk' + c, { text: 'columns differ (column ' + L + ')', rule: 'No two columns are the same.', cells: g.col(c), at: { t: 'col', i: c }, kind: 'differ', brokenText: 'two columns are the same' }).cons.push(dc);
      }
      return base(B, {
        nvars: g.n, givens, tools: ['1', '0'], howToCite: 'Click a cell for the no-three rule, or a row number or column letter for the balance rule.',
        name: (v, val) => ({ who: g.cn(v), one: 'is ' + val, many: 'are ' + val }),
        cellOf: v => v,
        anchorsAt(t) {
          if (t.t === 'cell') { const [r, c] = g.rc(t.id); return ['t' + t.id, 'r' + r, 'k' + c]; }
          return t.t === 'row' ? ['r' + t.i, 'ur' + t.i] : t.t === 'col' ? ['k' + t.i, 'uk' + t.i] : [];
        },
        markOf: (t, tool) => (t.t === 'cell' ? { v: t.id, val: tool === 0 ? 1 : 0 } : null),
        view: { w, h, cell(id, f) { const x = f.get(id); return !x ? { bg: 'unknown' } : { text: x.val, textCls: x.given ? 'given' : 'val', src: x }; } },
      });
    },
  };

  // ---------- Star Battle ----------
  LG.games.starbattle = {
    id: 'starbattle', title: 'Star Battle', blurb: 'Place stars so each row, column and region has the right number.',
    rules: [
      'Place stars in cells.',
      'Every row, every column and every outlined region holds exactly the stated number of stars (one, unless the puzzle title says two).',
      'Stars may not touch, not even diagonally. The game applies this rule for you: the cells around a star are marked empty.',
    ],
    demo: { id: 'demo', title: 'Demo', stars: 1, regions: ['AABB', 'AABC', 'DDCC', 'DDCC'] },
    create(def) {
      const { h, w, g, ch } = parse(def.regions), B = LG.builder(), n = def.stars || 1, regs = {};
      for (let id = 0; id < g.n; id++) (regs[ch(id)] = regs[ch(id)] || []).push(id);
      const need = 'exactly ' + n + (n === 1 ? ' star' : ' stars');
      for (const [k, cells] of Object.entries(regs))
        B.anchor('g' + k, { text: 'the region at ' + g.cn(cells[0]), rule: 'This region holds ' + need + '.', cells, count: 'cells', kind: 'region' }).cons.push(B.lin(cells, n, n));
      for (let r = 0; r < h; r++) B.anchor('r' + r, { text: 'row ' + (r + 1), rule: 'Row ' + (r + 1) + ' holds ' + need + '.', cells: g.row(r), count: 'cells', at: { t: 'row', i: r }, kind: 'row' }).cons.push(B.lin(g.row(r), n, n));
      for (let c = 0; c < w; c++) { const L = String.fromCharCode(65 + c); B.anchor('k' + c, { text: 'column ' + L, rule: 'Column ' + L + ' holds ' + need + '.', cells: g.col(c), count: 'cells', at: { t: 'col', i: c }, kind: 'column' }).cons.push(B.lin(g.col(c), n, n)); }
      for (let id = 0; id < g.n; id++) for (const y of g.nb8(id)) if (y > id) B.lin([id, y], 0, 1, { auto: 'hi' });
      return base(B, {
        nvars: g.n, tools: ['Star', 'Empty'], howToCite: 'Click a cell to cite its region, or a row number or column letter.',
        name: (v, val) => ({ who: g.cn(v), one: val ? 'is a star' : 'is empty', many: val ? 'are stars' : 'are empty' }),
        cellOf: v => v,
        anchorsAt(t) {
          if (t.t === 'cell') { const [r, c] = g.rc(t.id); return ['g' + ch(t.id), 'r' + r, 'k' + c]; }
          return t.t === 'row' ? ['r' + t.i] : t.t === 'col' ? ['k' + t.i] : [];
        },
        markOf: (t, tool) => (t.t === 'cell' ? { v: t.id, val: tool === 0 ? 1 : 0 } : null),
        view: { w, h, regions: Array.from({ length: g.n }, (_, id) => ch(id)), cell(id, f) { const x = f.get(id); return !x ? {} : x.val ? { icon: 'star', src: x } : { icon: x.auto ? 'dot' : 'x', src: x }; } },
      });
    },
  };

  // ---------- Thermometer ----------
  LG.games.thermometer = {
    id: 'thermometer', title: 'Thermometer', blurb: 'Fill thermometers to match the row and column counts.',
    rules: [
      'Every cell is part of a thermometer and is either filled with mercury or empty.',
      'The number beside a row or below a column says how many of its cells are filled.',
      'A thermometer fills from its bulb. The game applies this rule for you: filling a cell fills the cells towards the bulb, and an empty cell empties the cells towards the tip.',
    ],
    demo: { id: 'demo', title: 'Demo', w: 3, h: 3, vials: [[0, 1, 2], [3, 6], [4, 5], [8, 7]], rows: [2, 2, 1], cols: [2, 2, 1] },
    create(def) {
      const w = def.w, h = def.h, g = LG.grid(w, h), B = LG.builder();
      const lineRule = (key, label, cells, k, at) => B.anchor(key, { text: 'the ' + k + ' for ' + label, rule: 'Exactly ' + k + ' of the outlined cells ' + (k === 1 ? 'is' : 'are') + ' filled.', cells, count: 'cells', at, kind: 'count' }).cons.push(B.lin(cells, k, k));
      for (let r = 0; r < h; r++) lineRule('r' + r, 'row ' + (r + 1), g.row(r), def.rows[r], { t: 'clue', side: 'e', i: r });
      for (let c = 0; c < w; c++) lineRule('k' + c, 'column ' + String.fromCharCode(65 + c), g.col(c), def.cols[c], { t: 'clue', side: 's', i: c });
      for (const vial of def.vials) for (let i = 0; i + 1 < vial.length; i++) B.con({ k: 'lin', pos: [vial[i]], neg: [vial[i + 1]], lo: 0, hi: 1, auto: 'all' });
      return base(B, {
        nvars: g.n, tools: ['Filled', 'Empty'], howToCite: 'Click the number beside a row or below a column to cite it.',
        name: (v, val) => ({ who: g.cn(v), one: val ? 'is filled' : 'is empty', many: val ? 'are filled' : 'are empty' }),
        cellOf: v => v,
        anchorsAt: t => (t.t === 'clue' ? [(t.side === 'e' ? 'r' : 'k') + t.i] : t.t === 'row' ? ['r' + t.i] : t.t === 'col' ? ['k' + t.i] : []),
        noAnchor: () => 'Cite a row or column count: click the number beside the row or below the column.',
        markOf: (t, tool) => (t.t === 'cell' ? { v: t.id, val: tool === 0 ? 1 : 0 } : null),
        view: {
          w, h, clues: { e: def.rows, s: def.cols },
          cell(id, f) { const x = f.get(id); return x && !x.val ? { icon: x.auto ? 'dot' : 'x', src: x } : x ? { src: x } : {}; },
          overlay(f, geo) {
            const o = [], t = geo.s * 0.34;
            for (const vial of def.vials) {
              const a = vial[0], b = vial[vial.length - 1];
              o.push('<line x1="' + geo.cx(a) + '" y1="' + geo.cy(a) + '" x2="' + geo.cx(b) + '" y2="' + geo.cy(b) + '" stroke="var(--muted)" stroke-opacity=".35" stroke-width="' + t + '" stroke-linecap="round" pointer-events="none"/>');
              o.push('<circle cx="' + geo.cx(a) + '" cy="' + geo.cy(a) + '" r="' + t * 0.85 + '" fill="var(--muted)" fill-opacity=".35" pointer-events="none"/>');
              let last = -1; vial.forEach((c, i) => { const x = f.get(c); if (x && x.val) last = i; });
              if (last >= 0) {
                const e = vial[last], hyp = vial.slice(0, last + 1).some(c => f.get(c).depth > 0), col = hyp ? 'var(--hyp)' : 'var(--fill)';
                o.push('<line x1="' + geo.cx(a) + '" y1="' + geo.cy(a) + '" x2="' + geo.cx(e) + '" y2="' + geo.cy(e) + '" stroke="' + col + '" stroke-width="' + t * 0.72 + '" stroke-linecap="round" pointer-events="none"/>');
                o.push('<circle cx="' + geo.cx(a) + '" cy="' + geo.cy(a) + '" r="' + t * 0.72 + '" fill="' + col + '" pointer-events="none"/>');
              }
            }
            return o.join('');
          },
        },
      });
    },
  };
})();
