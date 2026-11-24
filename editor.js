// Board editors for the "New puzzle" screen: how to make a blank board for a game,
// which tools the palette offers, and what a click (or drag) with a tool does.
// target is {t:'cell', id} or {t:'clue', side, i}. apply returns true when it changed the board.
(function () {
  'use strict';
  const LG = window.LG, E = LG.editors = {};
  const rowsOf = (n, ch) => Array.from({ length: n }, () => ch.repeat(n));
  const zeros = n => new Array(n).fill(0), nulls = n => new Array(n).fill(null);
  const setCh = (rows, id, ch) => { const w = rows[0].length, r = Math.floor(id / w), c = id % w; if (rows[r][c] === ch) return false; rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1); return true; };
  const nums = (a, b, label) => { const o = []; for (let i = a; i <= b; i++) o.push({ label: (label || '') + i, t: 'cell', v: String(i) }); return o; };
  const counts = n => Array.from({ length: n + 1 }, (_, i) => ({ label: 'Count ' + i, t: 'clue', v: i }));
  const setCount = (def, t, tool) => { if (t.t !== 'clue' || tool.t !== 'clue') return false; if (t.side === 'e') def.rows[t.i] = tool.v; else if (t.side === 's') def.cols[t.i] = tool.v; else return false; return true; };
  const charGame = (sizes, tools, note) => ({ sizes, note, blank: n => ({ grid: rowsOf(n, '.') }), tools: typeof tools === 'function' ? tools : () => tools, apply: (def, t, tool) => t.t === 'cell' && tool.t === 'cell' && setCh(def.grid, t.id, tool.v) });

  E.lightup = charGame([5, 7, 10], [{ label: 'White cell', t: 'cell', v: '.' }, { label: 'Wall', t: 'cell', v: '#' }, ...nums(0, 4, 'Wall ')]);
  E.fillapix = charGame([5, 7, 10], [{ label: 'No number', t: 'cell', v: '.' }, ...nums(0, 9)]);
  E.minesweeper = charGame([5, 6, 8], [{ label: 'Hidden cell', t: 'cell', v: '.' }, ...nums(0, 8)], 'Numbered cells are safe. Every other cell is hidden and may hold a mine.');
  E.binary = charGame([4, 6, 8, 10], [{ label: 'Blank', t: 'cell', v: '.' }, ...nums(0, 1)]);
  E.sudoku = charGame([4, 6, 9], def => [{ label: 'Blank', t: 'cell', v: '.' }, ...nums(1, def.grid.length)]);
  E.masyu = charGame([4, 5, 6, 7], [{ label: 'No circle', t: 'cell', v: '.' }, { label: 'White circle', t: 'cell', v: 'W' }, { label: 'Black circle', t: 'cell', v: 'B' }]);
  E.nurikabe = {
    sizes: [5, 6, 7], blank: n => ({ grid: Array.from({ length: n }, () => zeros(n)) }),
    tools: () => [{ label: 'No number', t: 'cell', v: 0 }].concat(Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1), t: 'cell', v: i + 1 }))),
    apply(def, t, tool) { if (t.t !== 'cell' || tool.t !== 'cell') return false; const w = def.grid[0].length; def.grid[Math.floor(t.id / w)][t.id % w] = tool.v; return true; },
  };
  E.treetent = {
    sizes: [5, 6, 8], blank: n => ({ grid: rowsOf(n, '.'), rows: zeros(n), cols: zeros(n) }),
    tools: def => [{ label: 'Tree', t: 'cell', v: 'T' }, { label: 'No tree', t: 'cell', v: '.' }, ...counts(Math.ceil(def.grid.length / 2))],
    apply: (def, t, tool) => (t.t === 'cell' && tool.t === 'cell' ? setCh(def.grid, t.id, tool.v) : setCount(def, t, tool)),
    note: 'Place the trees. Then pick a count and click the number beside a row or below a column to set how many tents it holds.',
  };
  E.thermometer = {
    sizes: [4, 5, 6], blank: n => ({ w: n, h: n, vials: [], rows: zeros(n), cols: zeros(n) }),
    tools: def => [{ label: 'Draw thermometer', t: 'vial' }, { label: 'Erase thermometer', t: 'erase' }, ...counts(def.w)],
    apply(def, t, tool) {
      if (tool.t === 'erase' && t.t === 'cell') { const k = def.vials.findIndex(v => v.includes(t.id)); if (k < 0) return false; def.vials.splice(k, 1); return true; }
      return setCount(def, t, tool);
    },
    drag(def, a, b, tool) {
      if (tool.t !== 'vial') return false;
      const w = def.w, ra = Math.floor(a / w), ca = a % w, rb = Math.floor(b / w), cb = b % w;
      if (ra !== rb && ca !== cb) return false;
      const dr = Math.sign(rb - ra), dc = Math.sign(cb - ca), cells = [];
      for (let r = ra, c = ca; ; r += dr, c += dc) { cells.push(r * w + c); if (r === rb && c === cb) break; }
      if (cells.some(x => def.vials.some(v => v.includes(x)))) return false;
      def.vials.push(cells); return true;
    },
    note: 'With "Draw thermometer", drag from the bulb to the tip. Every cell should belong to a thermometer. Then pick a count and click the number beside a row or below a column.',
  };
  const FLEETS = { 5: [3, 2, 1, 1], 6: [3, 2, 2, 1, 1, 1], 7: [4, 3, 2, 2, 1, 1, 1], 8: [4, 3, 3, 2, 2, 2, 1, 1, 1] };
  E.battleship = {
    sizes: [5, 6, 7, 8], blank: n => ({ w: n, h: n, rows: zeros(n), cols: zeros(n), fleet: FLEETS[n].slice(), given: [] }),
    tools: def => [{ label: 'Unknown', t: 'cell', v: null }, { label: 'Ship, shown', t: 'cell', v: 1 }, { label: 'Water, shown', t: 'cell', v: 0 }, ...counts(def.w)],
    apply(def, t, tool) {
      if (t.t === 'cell' && tool.t === 'cell') { def.given = def.given.filter(x => x[0] !== t.id); if (tool.v !== null) def.given.push([t.id, tool.v]); return true; }
      return setCount(def, t, tool);
    },
    fields: [{ label: 'Ship lengths, separated by commas', get: d => d.fleet.join(', '), set: (d, s) => { const f = s.split(/[^0-9]+/).filter(Boolean).map(Number).filter(x => x > 0 && x <= d.w); if (!f.length) return false; d.fleet = f; return true; } }],
    note: 'Set the ship count for every row and column. A cell can be shown to the player as ship or water from the start.',
  };
  E.starbattle = {
    sizes: [5, 6, 7, 8], blank: n => ({ stars: 1, regions: Array.from({ length: n }, (_, r) => String.fromCharCode(65 + r).repeat(n)) }),
    tools: def => Array.from({ length: def.regions.length }, (_, i) => ({ label: 'Region ' + String.fromCharCode(65 + i), t: 'cell', v: String.fromCharCode(65 + i) })),
    apply: (def, t, tool) => t.t === 'cell' && tool.t === 'cell' && setCh(def.regions, t.id, tool.v),
    fields: [{ label: 'Stars in each row, column and region (1 or 2)', get: d => String(d.stars), set: (d, s) => { const k = +s; if (k !== 1 && k !== 2) return false; d.stars = k; return true; } }],
    note: 'Paint the regions. A board needs as many regions as it has rows.',
  };
  E.heyawake = {
    sizes: [5, 6, 7], blank: n => ({ regions: rowsOf(n, 'A'), nums: {} }),
    tools: () => [...'ABCDEFGHIJKL'].map(L => ({ label: 'Room ' + L, t: 'cell', v: L })).concat([{ label: 'No room number', t: 'room', v: null }], [0, 1, 2, 3, 4].map(i => ({ label: 'Room number ' + i, t: 'room', v: i }))),
    apply(def, t, tool) {
      if (t.t !== 'cell') return false;
      const w = def.regions[0].length, used = () => new Set(def.regions.join(''));
      if (tool.t === 'cell') { if (!setCh(def.regions, t.id, tool.v)) return false; const u = used(); for (const L of Object.keys(def.nums)) if (!u.has(L)) delete def.nums[L]; return true; }
      const L = def.regions[Math.floor(t.id / w)][t.id % w];
      if (tool.v === null) delete def.nums[L]; else def.nums[L] = tool.v;
      return true;
    },
    note: 'Paint the rooms. Then pick a room number and click any cell of a room to give the room that number.',
  };
  E.skyscrapers = {
    sizes: [3, 4, 5, 6], sides: ['n', 's', 'e', 'w'], blank: n => ({ n, clues: { n: nulls(n), s: nulls(n), e: nulls(n), w: nulls(n) } }),
    tools: def => [{ label: 'No clue', t: 'clue', v: null }].concat(Array.from({ length: def.n }, (_, i) => ({ label: 'Clue ' + (i + 1), t: 'clue', v: i + 1 }))),
    apply(def, t, tool) { if (t.t !== 'clue' || tool.t !== 'clue') return false; def.clues[t.side][t.i] = tool.v; return true; },
    note: 'Pick a clue and click one of the dots outside the grid.',
  };
  E.truthtable = {
    sizes: null, blank: () => ({ statements: ['A>B', 'A', 'B'] }), tools: () => [], apply: () => false,
    fields: [{ label: 'One statement per line. The last line is the conclusion. Use capital letters, and ~ for not, ^ for and, | for or, > for if-then, - for if and only if. Put brackets around a part that has its own connective.', multiline: true,
      get: d => d.statements.join('\n'), set: (d, s) => { const l = s.split('\n').map(x => x.replace(/\s+/g, '')).filter(Boolean); if (!l.length) return false; d.statements = l; return true; } }],
  };
})();
