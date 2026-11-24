// Tree Tent. Variables: tent(cell) for every cell without a tree, and
// link(tree, cell) for every tree and cell that sit side by side.
(function () {
  'use strict';
  const LG = window.LG;
  LG.games.treetent = {
    id: 'treetent', title: 'Tree Tent', blurb: 'Give every tree its own tent.',
    rules: [
      'Every cell without a tree is a tent or grass.',
      'Every tree has exactly one tent of its own, in a cell directly above, below, left or right of it.',
      'Every tent belongs to exactly one tree. Drag from a tree to a tent, or from a tent to a tree, to link them.',
      'The number beside a row or below a column says how many tents it holds.',
      'Tents may not touch, not even diagonally. Click a tent to cite this rule, then mark the cells around it as grass.',
      'The game applies one rule for you: a cell turns to grass when no tree is left that a tent there could belong to.',
    ],
    demo: { id: 'demo', title: 'Demo', grid: ['.T..', '....', 'T..T', '....'], rows: [1, 0, 1, 1], cols: [1, 0, 1, 1] },
    create(def) {
      const rows = def.grid, h = rows.length, w = rows[0].length, g = LG.grid(w, h), B = LG.builder();
      const isTree = id => rows[Math.floor(id / w)][id % w] === 'T';
      const tv = new Array(g.n).fill(-1), info = [];           // info[v] = {cell} or {tree, cell}
      for (let id = 0; id < g.n; id++) if (!isTree(id)) { tv[id] = info.length; info.push({ cell: id }); }
      const linksOf = {}, linksInto = {}, lv = {};
      for (let t = 0; t < g.n; t++) if (isTree(t)) for (const c of g.nb4(t)) if (!isTree(c)) {
        const v = info.length; info.push({ tree: t, cell: c }); lv[t + ',' + c] = v;
        (linksOf[t] = linksOf[t] || []).push(v); (linksInto[c] = linksInto[c] || []).push(v);
      }
      const count = (key, label, cells, k, at) => B.anchor(key, { text: 'the ' + k + ' for ' + label, rule: 'Exactly ' + k + ' of the outlined cells ' + (k === 1 ? 'is a tent.' : 'are tents.'), cells, count: 'cells', at, kind: 'count' }).cons.push(B.lin(cells.map(c => tv[c]), k, k));
      for (let r = 0; r < h; r++) count('r' + r, 'row ' + (r + 1), g.row(r).filter(c => !isTree(c)), def.rows[r], { t: 'clue', side: 'e', i: r });
      for (let c = 0; c < w; c++) count('k' + c, 'column ' + String.fromCharCode(65 + c), g.col(c).filter(x => !isTree(x)), def.cols[c], { t: 'clue', side: 's', i: c });
      for (let t = 0; t < g.n; t++) if (isTree(t))
        B.anchor('c' + t, { text: 'the tree at ' + g.cn(t), rule: 'This tree has exactly one tent of its own, in one of the outlined cells.', cells: g.nb4(t).filter(c => !isTree(c)), count: 'cells', at: { t: 'cell', id: t }, kind: 'tree', brokenText: 'the tree at ' + g.cn(t) + ' cannot get a tent' })
          .cons.push(B.lin(linksOf[t] || [], 1, 1));
      const isLink = v => info[v].tree !== undefined;
      for (let c = 0; c < g.n; c++) if (!isTree(c))
        B.anchor('c' + c, { text: 'the tent rule at ' + g.cn(c), rule: 'A tent belongs to exactly one tree beside it, and grass belongs to none.', cells: g.nb4(c).filter(isTree), at: { t: 'cell', id: c }, kind: 'tent', how: 'If this is a tent with one tree left, drag between them to link them.', brokenText: 'the tent at ' + g.cn(c) + ' has no tree' })
          .cons.push(B.con({ k: 'lin', pos: [tv[c]], neg: linksInto[c] || [], lo: 0, hi: 0, auto: (v, val) => !(isLink(v) && val === 1) }));
      const touch = {};
      // Not automatic: the player cites a tent and marks the cells around it.
      for (let a = 0; a < g.n; a++) if (!isTree(a)) for (const b of g.nb8(a)) if (b > a && !isTree(b)) { const i = B.lin([tv[a], tv[b]], 0, 1); (touch[a] = touch[a] || []).push(i); (touch[b] = touch[b] || []).push(i); }
      for (let c = 0; c < g.n; c++) if (touch[c])
        B.anchor('n' + c, { text: 'the tent at ' + g.cn(c) + ' touches no other tent', rule: 'Tents may not touch, not even diagonally, so the outlined cells around this tent are grass.', cells: g.nb8(c).filter(x => !isTree(x)), at: { t: 'cell', id: c }, kind: 'touch', how: 'Mark the outlined cells as grass.', brokenText: 'the tent at ' + g.cn(c) + ' touches another tent' }).cons.push(...touch[c]);
      const trees = []; for (let t = 0; t < g.n; t++) if (isTree(t)) trees.push(t);
      // Can every tree still get its own tent, given the links decided so far?
      function matching(f) {
        const tents = []; for (let c = 0; c < g.n; c++) if (tv[c] >= 0 && f.get(tv[c]) && f.get(tv[c]).val) tents.push(c);
        if (tents.length !== trees.length) return false;
        const opts = t => { const o = g.nb4(t).filter(c => tents.includes(c) && !(f.get(lv[t + ',' + c]) && !f.get(lv[t + ',' + c]).val)); const fixed = o.find(c => f.get(lv[t + ',' + c]) && f.get(lv[t + ',' + c]).val); return fixed === undefined ? o : [fixed]; };
        const owner = {};
        const tryT = (t, seen) => { for (const c of opts(t)) { if (seen.has(c)) continue; seen.add(c); if (owner[c] === undefined || tryT(owner[c], seen)) { owner[c] = t; return true; } } return false; };
        return trees.every(t => tryT(t, new Set()));
      }
      const tentVars = info.map((x, v) => v).filter(v => !isLink(v));
      return {
        nvars: info.length, cons: B.cons, anchor: k => B.anchors[k], anchorKeys: B.anchorKeys, tools: ['Tent', 'Grass'],
        need: tentVars, check: matching,
        howToCite: 'Click the number beside a row or below a column for its count. Click a tree, a tent or a cell for its own rule. Drag between a tree and a tent to link them.',
        name(v, val) { const x = info[v]; return isLink(v) ? { who: g.cn(x.tree) + '-' + g.cn(x.cell), one: val ? 'is a tree and tent pair' : 'is not a pair', many: val ? 'are tree and tent pairs' : 'are not pairs' } : { who: g.cn(x.cell), one: val ? 'is a tent' : 'is grass', many: val ? 'are tents' : 'are grass' }; },
        cellOf: v => (isLink(v) ? [info[v].tree, info[v].cell] : info[v].cell),
        anchorsAt(t, f) {
          if (t.t === 'cell') {
            const [r, c] = g.rc(t.id); if (isTree(t.id)) return ['c' + t.id];
            const x = f && f.get(tv[t.id]), isTent = x && x.val && B.anchors['n' + t.id];
            return (isTent ? ['n' + t.id] : []).concat(['c' + t.id]);
          }
          if (t.t === 'clue') return [(t.side === 'e' ? 'r' : 'k') + t.i];
          return t.t === 'row' ? ['r' + t.i] : t.t === 'col' ? ['k' + t.i] : [];
        },
        markOf(t, tool, right, key) {
          if (t.t !== 'cell' || isTree(t.id)) return null;
          const tree = key && key[0] === 'c' && isTree(+key.slice(1)) ? +key.slice(1) : null;
          if (tree !== null && tool === 0 && lv[tree + ',' + t.id] !== undefined) return { v: lv[tree + ',' + t.id], val: 1 };
          return { v: tv[t.id], val: tool === 0 ? 1 : 0 };
        },
        drag(a, b) {
          const tree = isTree(a) ? a : isTree(b) ? b : null, cell = tree === a ? b : a;
          if (tree === null || isTree(cell)) return { msg: 'Drag between a tree and the cell beside it.' };
          const v = lv[tree + ',' + cell];
          if (v === undefined) return { msg: 'A tree can only be linked to a cell directly beside it.' };
          return { tries: [{ anchor: 'c' + tree, v, val: 1 }, { anchor: 'c' + cell, v, val: 1 }], failMsg: 'Nothing forces this link yet. The tree must have only this cell left, or the tent only this tree.' };
        },
        view: {
          w, h, clues: { e: def.rows, s: def.cols },
          cell(id, f) { if (isTree(id)) return { bg: 'grass', icon: 'tree' }; const x = f.get(tv[id]); return !x ? {} : x.val ? { bg: 'grass', icon: 'tent', src: x } : { bg: 'grass', src: x }; },
          overlay(f, geo) { let o = ''; info.forEach((x, v) => { const st = isLink(v) && f.get(v); if (st && st.val) o += '<line ' + (st.depth > 0 ? 'style="stroke:var(--hyp)" class="link d' + ((st.depth - 1) % 4 + 1) + '" ' : 'class="link" ') + 'x1="' + geo.cx(x.tree) + '" y1="' + geo.cy(x.tree) + '" x2="' + geo.cx(x.cell) + '" y2="' + geo.cy(x.cell) + '" stroke-opacity=".7"/>'; }); return o; },
        },
      };
    },
  };
})();
