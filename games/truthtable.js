// Short Truth Table. Statements use ~ (not), ^ (and), | (or), > (if-then), - (if and only if).
// Every letter and every connective is a variable: true or false.
(function () {
  'use strict';
  const LG = window.LG;
  const SHOW = { '~': '¬', '^': '∧', '|': '∨', '>': '→', '-': '↔' };
  const TABLE = { '^': (a, b) => a & b, '|': (a, b) => a | b, '>': (a, b) => (a ? b : 1), '-': (a, b) => (a === b ? 1 : 0) };
  const TEXT = {
    '~': '"not P" is true exactly when P is false.',
    '^': '"P and Q" is true exactly when both parts are true.',
    '|': '"P or Q" is false exactly when both parts are false.',
    '>': '"if P then Q" is false exactly when P is true and Q is false.',
    '-': '"P if and only if Q" is true exactly when both parts have the same value.',
  };
  // Returns the position of the main symbol of the statement and fills `nodes`.
  function parse(s, nodes) {
    let i = 0;
    const unary = () => {
      if (s[i] === '~') { const at = i++; const c = unary(); nodes.push({ at, op: '~', kids: [c] }); return at; }
      if (s[i] === '(') { i++; const m = binary(); if (s[i] !== ')') throw new Error('missing ) in ' + s); i++; return m; }
      if (/[A-Z]/.test(s[i] || '')) return i++;
      throw new Error('cannot read ' + s + ' at ' + i);
    };
    const binary = () => { const l = unary(); if (i < s.length && TABLE[s[i]]) { const at = i, op = s[i++], r = unary(); nodes.push({ at, op, kids: [l, r] }); return at; } return l; };
    const m = binary();
    if (i !== s.length) throw new Error('cannot read ' + s + ' at ' + i);
    return m;
  }
  LG.games.truthtable = {
    id: 'truthtable', title: 'Short Truth Table', blurb: 'Test an argument by hunting for a counterexample.',
    rules: [
      'Each row is a statement. Every letter and every connective gets a truth value, true or false.',
      'The premises start out true and the conclusion (the last row, marked with a therefore sign) starts out false. You are looking for a way that could happen.',
      'Each connective follows its truth table: not, and, or, if-then, if and only if.',
      'A letter has the same value everywhere. The game applies this rule for you.',
      'If you fill everything in, you have found a counterexample and the argument is invalid. If a rule breaks with no assumption open, no counterexample exists and the argument is valid.',
    ],
    demo: { id: 'demo', title: 'Demo', statements: ['A>B', '~B', '~A'] },
    create(def) {
      const S = def.statements, h = S.length, w = Math.max(...S.map(x => x.length)), g = LG.grid(w, h), B = LG.builder();
      const vOf = new Array(g.n).fill(-1), info = [], givens = [], letters = {};
      S.forEach((s, r) => { for (let c = 0; c < s.length; c++) if (/[A-Z]/.test(s[c]) || SHOW[s[c]]) { vOf[g.id(r, c)] = info.length; info.push({ cell: g.id(r, c), ch: s[c], row: r }); } });
      S.forEach((s, r) => {
        const nodes = [], main = parse(s, nodes), V = c => vOf[g.id(r, c)];
        givens.push([V(main), r === h - 1 ? 0 : 1]);
        for (const n of nodes) {
          const self = V(n.at), kids = n.kids.map(V), pats = [];
          if (n.op === '~') pats.push([[self, 1], [kids[0], 0]], [[self, 0], [kids[0], 1]]);
          else for (const a of [0, 1]) for (const b of [0, 1]) pats.push([[self, TABLE[n.op](a, b)], [kids[0], a], [kids[1], b]]);
          B.anchor('c' + g.id(r, n.at), { text: 'the ' + SHOW[n.op] + ' at ' + g.cn(g.id(r, n.at)), rule: TEXT[n.op], cells: [n.at, ...n.kids].map(c => g.id(r, c)), at: { t: 'cell', id: g.id(r, n.at) }, kind: n.op, brokenText: 'the ' + SHOW[n.op] + ' at ' + g.cn(g.id(r, n.at)) + ' does not fit its truth table' })
            .cons.push(B.con({ k: 'pat', pats }));
        }
        for (let c = 0; c < s.length; c++) if (/[A-Z]/.test(s[c])) (letters[s[c]] = letters[s[c]] || []).push(V(c));
      });
      for (const vs of Object.values(letters)) for (let i = 0; i + 1 < vs.length; i++) B.con({ k: 'lin', pos: [vs[i]], neg: [vs[i + 1]], lo: 0, hi: 0, auto: 'all' });
      return {
        nvars: info.length, cons: B.cons, anchor: k => B.anchors[k], anchorKeys: B.anchorKeys, tools: ['True', 'False'], givens,
        rootContradiction: true,
        refutedText: 'Solved! The premises cannot all be true while the conclusion is false, so the argument is valid.',
        solvedText: 'Solved! This is a counterexample: the premises are true and the conclusion is false, so the argument is invalid.',
        howToCite: 'Click a connective to cite its truth table. Then mark one of its parts, or the connective itself.',
        name: (v, val) => ({ who: (SHOW[info[v].ch] || info[v].ch) + ' at ' + g.cn(info[v].cell), one: val ? 'is true' : 'is false', many: val ? 'are true' : 'are false' }),
        cellOf: v => info[v].cell,
        anchorsAt: t => (t.t === 'cell' && B.anchors['c' + t.id] ? ['c' + t.id] : []),
        noAnchor: t => (t.t === 'cell' && vOf[t.id] >= 0 ? 'A letter has no rule of its own. Cite a connective.' : 'Click a connective to cite its truth table.'),
        markOf: (t, tool) => (t.t === 'cell' && vOf[t.id] >= 0 ? { v: vOf[t.id], val: tool === 0 ? 1 : 0 } : null),
        view: {
          w, h, clues: { w: S.map((_, r) => (r === h - 1 ? '∴' : 'P' + (r + 1))) },
          cell(id, f) {
            const r = Math.floor(id / w), c = id % w, ch = S[r][c];
            if (ch === undefined) return { bg: 'blank' };
            if (vOf[id] < 0) return { bg: 'blank', text: ch };
            const x = f.get(vOf[id]);
            return { bg: !x ? '' : x.val ? 'tru' : 'fal', text: SHOW[ch] || ch, corner: !x ? null : x.val ? 'T' : 'F', src: x && !x.given ? x : null, textCls: x && x.given ? 'given' : 'val' };
          },
        },
      };
    },
  };
})();
