// Light Up: grid of '.', '#', and digits 0-4 for numbered walls.
(function () {
  'use strict';
  const LG = window.LG;
  LG.games.lightup = {
    id: 'lightup', title: 'Light Up', blurb: 'Place bulbs so that every white cell is lit.',
    rules: [
      'Place light bulbs in white cells.',
      'A bulb lights its own cell and every cell in its row and column, up to the nearest wall.',
      'Every white cell must be lit.',
      'A numbered wall must have exactly that many bulbs in the cells directly above, below, left and right of it.',
      'No bulb may shine on another bulb. The game applies this rule for you: a lit cell (yellow) counts as empty.',
    ],
    demo: { id: 'demo', title: 'Demo', grid: ['..1.', '....', '#2..', '....'] },
    create(def) {
      const rows = def.grid, h = rows.length, w = rows[0].length, g = LG.grid(w, h), B = LG.builder();
      const ch = id => rows[Math.floor(id / w)][id % w], isW = id => ch(id) === '.', num = id => (ch(id) >= '0' && ch(id) <= '4' ? +ch(id) : null);
      const vOf = new Array(g.n).fill(-1), cells = [];
      for (let id = 0; id < g.n; id++) if (isW(id)) { vOf[id] = cells.length; cells.push(id); }
      const run = (id, dr, dc) => { const o = []; let [r, c] = g.rc(id); r += dr; c += dc; while (g.inside(r, c) && isW(g.id(r, c))) { o.push(g.id(r, c)); r += dr; c += dc; } return o; };
      const vis = {}, segs = new Map();
      for (const id of cells) {
        const hs = [...run(id, 0, -1).reverse(), id, ...run(id, 0, 1)], vs = [...run(id, -1, 0).reverse(), id, ...run(id, 1, 0)];
        vis[id] = [...hs, ...vs].filter(x => x !== id);
        for (const s of [hs, vs]) if (s.length > 1) segs.set(s.join(','), s);
      }
      for (let id = 0; id < g.n; id++) {
        const k = num(id); if (k === null) continue;
        const nb = g.nb4(id).filter(isW);
        B.anchor('c' + id, { text: 'the ' + k + ' at ' + g.cn(id), rule: 'Exactly ' + k + ' of the outlined cells ' + (k === 1 ? 'is a bulb.' : 'are bulbs.'), cells: nb, count: 'cells', at: { t: 'cell', id }, kind: 'number' })
          .cons.push(B.lin(nb.map(x => vOf[x]), k, k));
      }
      for (const id of cells) {
        const sc = [id, ...vis[id]];
        B.anchor('c' + id, { text: g.cn(id) + ' must be lit', rule: g.cn(id) + ' must be lit, so at least one outlined cell is a bulb.', cells: sc, count: 'cells', at: { t: 'cell', id }, kind: 'lit', brokenText: 'nothing can light ' + g.cn(id) })
          .cons.push(B.lin(sc.map(x => vOf[x]), 1, 99));
      }
      const shine = {};
      for (const s of segs.values()) { const i = B.lin(s.map(x => vOf[x]), 0, 1, { auto: 'hi' }); s.forEach(c => (shine[c] = shine[c] || []).push(i)); }
      for (const id of cells) if (shine[id])
        B.anchor('b' + id, { text: 'no bulb shines on another (the bulb at ' + g.cn(id) + ')', rule: 'No bulb may shine on another bulb, so the outlined cells this bulb lights are empty.', cells: vis[id], at: { t: 'cell', id }, kind: 'shine', info: true }).cons.push(...shine[id]);
      let lit = new Set();
      return {
        nvars: cells.length, cons: B.cons, anchor: k => B.anchors[k], anchorKeys: B.anchorKeys, tools: ['Bulb', 'Empty'],
        howToCite: 'Click a clue to cite it as your reason: a number, or any white cell (it must be lit). Click a bulb to see why the cells it lights are empty.',
        name: (v, val) => ({ who: g.cn(cells[v]), one: val ? 'is a bulb' : 'is empty', many: val ? 'are bulbs' : 'are empty' }),
        cellOf: v => cells[v],
        anchorsAt(t, f) {
          if (t.t !== 'cell') return [];
          if (num(t.id) !== null) return ['c' + t.id];
          if (!isW(t.id)) return [];
          const x = f.get(vOf[t.id]);
          return x && x.val ? (B.anchors['b' + t.id] ? ['b' + t.id] : []) : ['c' + t.id];
        },
        noAnchor: t => (t.t === 'cell' && isW(t.id) ? 'A bulb already rules out every cell it shines on, so there is nothing to cite here.' : 'A wall without a number has no rule to cite.'),
        markOf: (t, tool) => (t.t === 'cell' && isW(t.id) ? { v: vOf[t.id], val: tool === 0 ? 1 : 0 } : null),
        view: {
          w, h,
          begin(f) { lit = new Set(); for (const id of cells) { const x = f.get(vOf[id]); if (x && x.val) { lit.add(id); vis[id].forEach(y => lit.add(y)); } } },
          cell(id, f) {
            if (!isW(id)) return { bg: 'wall', text: num(id), textCls: 'walltext' };
            const x = f.get(vOf[id]), bg = lit.has(id) ? 'lit' : '';
            if (!x) return { bg };
            if (x.val) return { bg, icon: 'bulb', src: x };
            return x.auto ? { bg } : { bg, icon: 'x', src: x };
          },
        },
      };
    },
  };
})();
