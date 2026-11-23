// Interface shared by every game. Game logic lives in core.js and games/*.js.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const REPO = 'https://github.com/stanleybak2/puzzle-proofs';

  let game = null, defs = [], pi = 0, G = null, proof = null;
  let anchor = null, anchorAt = null, anchorIdx = 0, mode = 'deduce', mark = 0, digit = 0, msg = null, wasSolved = false, demo = null, geo = null;
  const say = (text, kind) => { msg = text ? { text, kind: kind || 'err' } : null; };

  // ---------- storage ----------
  const KEY = 'puzzle-proofs:v1';
  const readAll = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const writeAll = fn => { try { const all = readAll(); fn(all); localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* play on without saving */ } };
  const pkey = () => game.id + '/' + defs[pi].id;
  function store() {
    if (demo) return;
    writeAll(all => {
      all.last = { game: game.id, puzzle: defs[pi].id }; all.p = all.p || {}; all.done = all.done || {};
      if (proof.root.items.length || proof.hist.length || proof.root.closed) all.p[pkey()] = { root: proof.root, hist: proof.hist.slice(-300) };
      else delete all.p[pkey()];
      if (proof.solved()) all.done[pkey()] = 1;
    });
  }

  // ---------- icons (drawn in a 24 x 24 box) ----------
  const ICON = {
    bulb: '<path class="icon-stroke" fill="var(--bulb)" stroke="var(--ink)" stroke-width="1.3" stroke-linejoin="round" d="M12 2.2a6.8 6.8 0 0 0-4 12.3c.7.5 1.1 1.3 1.1 2.1v.6h5.8v-.6c0-.8.4-1.6 1.1-2.1a6.8 6.8 0 0 0-4-12.3z"/><path fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".85" d="M8.6 8.4a3.6 3.6 0 0 1 2.3-2.6"/><rect fill="var(--ink)" x="9.1" y="18.1" width="5.8" height="1.9" rx=".9"/><rect fill="var(--ink)" x="10.2" y="20.7" width="3.6" height="1.6" rx=".8"/>',
    tree: '<rect x="10.6" y="16" width="2.8" height="5.5" fill="#7a5230"/><path fill="var(--tree)" stroke="var(--ink)" stroke-width=".8" stroke-linejoin="round" d="M12 2.5l5.2 7h-2.6l3.9 6.8H5.5l3.9-6.8H6.8z"/>',
    tent: '<path class="icon-stroke" fill="var(--tent)" stroke="var(--ink)" stroke-width="1.2" stroke-linejoin="round" d="M12 4.5L21 19.5H3z"/><path fill="var(--ink)" opacity=".75" d="M12 11l3.2 8.5H8.8z"/>',
    star: '<path class="icon-stroke" fill="var(--star)" stroke="var(--ink)" stroke-width="1.1" stroke-linejoin="round" d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/>',
    mine: '<circle class="icon-stroke" cx="12" cy="12" r="6" fill="var(--ink)" stroke="var(--ink)" stroke-width="1"/><path stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round" d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/><circle cx="10" cy="10" r="1.6" fill="#fff" opacity=".8"/>',
    ship: '<rect class="icon-stroke" x="4" y="4" width="16" height="16" rx="4" fill="var(--ship)" stroke="var(--ink)" stroke-width="1.2"/>',
    fill: '<rect class="icon-stroke" x="3.5" y="3.5" width="17" height="17" rx="3" fill="var(--fill)" stroke="var(--ink)" stroke-width="1"/>',
    dot: '<circle cx="12" cy="12" r="2.4" fill="var(--muted)"/>',
    x: '<path class="xmark" d="M7.5 7.5l9 9M16.5 7.5l-9 9"/>',
    pearlW: '<circle cx="12" cy="12" r="7" fill="#fff" stroke="var(--ink)" stroke-width="1.8"/>',
    pearlB: '<circle cx="12" cy="12" r="7.5" fill="var(--ink)"/>',
  };

  // ---------- navigation ----------
  function showHome() {
    game = null; G = null; demo = null;
    $('play').hidden = true; $('home').hidden = false; closeWin(); stopFx();
    const all = readAll(), done = all.done || {};
    const box = $('cards'); box.textContent = '';
    for (const id of LG.order) {
      const gm = LG.games[id], list = LG.puzzles[id] || [];
      if (!gm || !list.length) continue;
      const n = list.filter(p => done[id + '/' + p.id]).length;
      const b = el('button', 'gcard');
      b.appendChild(el('b', null, gm.title)); b.appendChild(el('span', null, gm.blurb));
      b.appendChild(el('i', null, n ? n + ' of ' + list.length + ' solved' : list.length + ' puzzles'));
      b.onclick = () => openGame(id);
      box.appendChild(b);
    }
    writeAll(a => { delete a.last; });
    document.title = 'Puzzle proofs';
  }
  function openGame(id, puzzleId) {
    game = LG.games[id]; defs = LG.puzzles[id];
    $('home').hidden = true; $('play').hidden = false;
    $('game-title').textContent = game.title; document.title = game.title + ' proofs';
    const rules = $('rules'); rules.textContent = ''; game.rules.forEach(r => rules.appendChild(el('li', null, r)));
    for (const sel of [$('pick'), $('win-pick')]) { sel.textContent = ''; defs.forEach((p, i) => { const o = el('option', null, p.title); o.value = i; sel.appendChild(o); }); }
    const all = readAll();
    let i = defs.findIndex(p => p.id === puzzleId);
    if (i < 0) i = Math.max(0, defs.findIndex(p => !(all.done || {})[id + '/' + p.id]));
    if (game.demo && !(all.demo || {})[id]) startDemo(i); else load(i);
  }
  function load(i, fresh) {
    closeWin(); stopFx(); demo = null; pi = i; $('pick').selectedIndex = i;
    G = game.create(defs[i]); proof = new LG.Proof(G);
    const saved = (readAll().p || {})[pkey()];
    if (saved && !fresh) { proof.root = saved.root; proof.hist = saved.hist || []; proof.touch(); }
    resetUi();
    if (saved && !fresh) say('Picked up where you left off. Restart clears this puzzle.', 'ok');
    wasSolved = proof.solved();
    render();
  }
  function resetUi() { anchor = null; anchorAt = null; anchorIdx = 0; mode = 'deduce'; msg = null; digit = 0; buildMarks(); }

  // ---------- demo ----------
  function startDemo(returnTo) {
    closeWin(); stopFx();
    G = game.create(game.demo); proof = new LG.Proof(G);
    resetUi();
    // The walk-through is planned from direct steps only, one cited clue per page.
    const P = LG.plan(G), pages = [];
    pages.push({ html: '<b>How ' + esc(game.title) + ' works</b><ul>' + game.rules.map(r => '<li>' + esc(r) + '</li>').join('') + '</ul>' });
    pages.push({ html: 'In a proof every mark needs a reason. You click the clue that is your reason, and then you mark what that one rule forces. The next pages solve a small puzzle this way. Press Next to watch each step.' });
    for (const st of P.steps) {
      const a = G.anchor(st.key);
      if (st.broken) pages.push({ key: st.key, contra: true, html: 'Click <b>' + esc(a.text) + '</b>. ' + esc(a.rule) + ' That can no longer hold, and no assumption is open. Pressing "This rule is broken" ends the proof.' });
      else pages.push({ key: st.key, marks: st.marks, html: 'Click <b>' + esc(a.text) + '</b>. ' + esc(a.rule) + ' ' + esc(whyText(st.key, st.facts)) + ' So ' + esc(marksText(st.marks)) + '.' });
    }
    pages.push({ html: (P.solved ? '<b>Solved.</b> ' : '') + 'When no single rule forces anything, use <b>Assume</b> or <b>Case split</b>. "Proof controls" under the board explains both. Now try it yourself.' });
    demo = { pages, i: 0, returnTo };
    wasSolved = true;   // no fireworks or popup during the demo
    showDemoPage();
  }
  function showDemoPage() {
    const p = demo.pages[demo.i];
    anchor = p.key || null; anchorAt = anchor ? G.anchor(anchor).at : null; msg = null;
    $('demo-count').textContent = 'Demo, step ' + (demo.i + 1) + ' of ' + demo.pages.length;
    $('demo-text').innerHTML = p.html;
    $('demo-next').textContent = demo.i === demo.pages.length - 1 ? 'Start playing' : 'Next';
    render();
  }
  function demoNext() {
    if (!demo) return;
    const p = demo.pages[demo.i];
    if (p.marks) p.marks.forEach(m => proof.tryStep(p.key, m[0], m[1]));
    if (p.contra) proof.contradiction(p.key);
    if (demo.i === demo.pages.length - 1) return endDemo();
    demo.i++; showDemoPage();
  }
  function endDemo() {
    if (!demo) return;
    const back = demo.returnTo || 0;
    writeAll(a => { a.demo = a.demo || {}; a.demo[game.id] = 1; });
    load(back);
  }
  function whyText(key, f) {
    const a = G.anchor(key);
    for (const i of a.cons) {
      const c = G.cons[i];
      if (c.k !== 'lin' || c.neg || !a.count || !LG.forced(c, f).length) continue;
      const s = LG.linState(c, f);
      if (s.cur >= c.hi) return 'It already has ' + s.cur + ', so the other ' + a.count + ' are ruled out.';
      if (s.cur + s.up.length === c.lo) return s.cur ? 'It has ' + s.cur + ' so far and exactly as many undecided ' + a.count + ' as it still needs.' : 'Exactly as many ' + a.count + ' are still open as it needs.';
    }
    return 'Only one way is left to satisfy it.';
  }

  // ---------- text ----------
  function marksText(marks) {
    const groups = [];
    for (const [v, val] of marks) {
      const n = G.name(v, val); let g = groups.find(x => x.one === n.one);
      if (!g) groups.push(g = { one: n.one, many: n.many || n.one, who: [] });
      if (!g.who.includes(n.who)) g.who.push(n.who);
    }
    return groups.map(g => g.who.join(', ') + ' ' + (g.who.length > 1 ? g.many : g.one)).join('; ');
  }
  const one = (v, val) => { const n = G.name(v, val); return n.who + ' ' + n.one; };
  const brokenText = key => { const a = G.anchor(key); return a.brokenText || a.text + ' can no longer be satisfied'; };

  // ---------- actions ----------
  const report = (r, okText) => { if (r.ok) say(okText || '', 'ok'); else say(r.msg); return r.ok; };
  const sameTarget = (a, b) => a && b && a.t === b.t && a.id === b.id && a.i === b.i && a.side === b.side && a.v === b.v;
  function setAnchorFrom(target, f) {
    const keys = G.anchorsAt(target, f) || [];
    if (!keys.length) { anchor = null; anchorAt = null; say((G.noAnchor && G.noAnchor(target, f)) || 'There is no rule to cite there.'); return; }
    anchorIdx = sameTarget(target, anchorAt) && keys.includes(anchor) ? (keys.indexOf(anchor) + 1) % keys.length : 0;
    anchor = keys[anchorIdx]; anchorAt = target;
  }
  function onTarget(target, right) {
    if (demo) return;
    say(null);
    const f = proof.facts();
    const tool = G.digits ? digit : (right ? 1 - mark : mark);
    if (mode === 'suppose' || mode === 'split') {
      const m = G.markOf(target, tool, G.digits ? right : false, null, f);
      if (!m || m.v == null) say((m && m.msg) || 'Pick an undecided cell.');
      else if (mode === 'suppose') report(proof.suppose(m.v, m.val), 'Assumption opened. Deduce inside it. If a rule becomes impossible, cite it and press "This rule is broken".');
      else { const sp = G.splitOf ? G.splitOf(target, f) : null; report(sp && sp.anchor ? proof.casesAnchor(sp.anchor) : proof.casesVar(m.v), 'Cases opened. Click a case to work in it.'); }
      mode = 'deduce'; anchor = null; anchorAt = null;
      return render();
    }
    if (anchor) {
      const same = sameTarget(target, anchorAt), keys = same ? (G.anchorsAt(target, f) || []) : [];
      const m = G.markOf(target, tool, G.digits ? right : false, anchor, f);
      const vs = G.anchor(anchor).cons.map(i => LG.conVars(G.cons[i]));
      const can = m && m.v != null && !f.has(m.v) && vs.some(x => !x || x.includes(m.v));
      // Clicking the cited place again marks it when the rule forces that; otherwise it moves to the next rule there.
      if (can && (!same || keys.length <= 1 || proof.forcedBy(anchor, f).some(e => e[0] === m.v && e[1] === m.val))) {
        report(proof.tryStep(anchor, m.v, m.val), one(m.v, m.val) + '.'); return render();
      }
      if (same) { if (keys.length > 1) setAnchorFrom(target, f); else { anchor = null; anchorAt = null; } return render(); }
    }
    setAnchorFrom(target, f);
    render();
  }
  function onDrag(a, b) {
    if (demo || !G.drag) return;
    say(null);
    const f = proof.facts(), d = G.drag(a, b, f);
    if (!d || !d.tries) { say((d && d.msg) || 'Nothing to link there.'); return render(); }
    let last = null;
    for (const t of d.tries) { last = proof.tryStep(t.anchor, t.v, t.val); if (last.ok) { say(one(t.v, t.val) + '.', 'ok'); anchor = null; anchorAt = null; return render(); } }
    say(d.failMsg || last.msg); render();
  }
  const act = (fn, after) => () => { say(null); const r = fn(); if (report(r, typeof after === 'string' ? after : null) && typeof after === 'function') after(r); render(); };

  // ---------- board ----------
  function renderBoard(f) {
    const V = G.view, w = V.w, h = V.h, cl = V.clues || {};
    const room = innerWidth <= 520 ? innerWidth - 70 : innerWidth * 0.5 - 70;
    const s = Math.max(20, Math.min(54, Math.floor(Math.min(500, room) / (w + (cl.w ? 0.7 : 0) + (cl.e ? 0.7 : 0)))));
    const band = Math.round(s * 0.7), ox = 20 + (cl.w ? band : 0), oy = 18 + (cl.n ? band : 0);
    const W = ox + w * s + (cl.e ? band : 4), H = oy + h * s + (cl.s ? band : 4);
    geo = { s, ox, oy, x: c => ox + c * s, y: r => oy + r * s, cx: id => ox + (id % w) * s + s / 2, cy: id => oy + Math.floor(id / w) * s + s / 2 };
    if (V.begin) V.begin(f);
    const a = anchor ? G.anchor(anchor) : null, o = [];
    const icon = (name, x, y, size) => '<g transform="translate(' + x + ' ' + y + ') scale(' + (size / 24) + ')">' + ICON[name] + '</g>';
    o.push('<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">');
    const lab = (cls, x, y, text, attrs) => '<text class="' + cls + '" x="' + x + '" y="' + y + '" text-anchor="middle" dominant-baseline="central" ' + (attrs || '') + '>' + esc(text) + '</text>';
    const clickable = (t, i) => (G.anchorsAt({ t, i }, f) || []).length > 0;
    for (let c = 0; c < w; c++) { const ck = clickable('col', c); o.push(lab('lab' + (ck ? ' click' : ''), geo.x(c) + s / 2, 9, String.fromCharCode(65 + c), ck ? 'data-t="col" data-i="' + c + '"' : '')); }
    for (let r = 0; r < h; r++) { const ck = clickable('row', r); o.push(lab('lab' + (ck ? ' click' : ''), 10, geo.y(r) + s / 2, r + 1, ck ? 'data-t="row" data-i="' + r + '"' : '')); }
    const cluePos = (side, i) => side === 'n' ? [geo.x(i) + s / 2, oy - band / 2] : side === 's' ? [geo.x(i) + s / 2, oy + h * s + band / 2] : side === 'w' ? [ox - band / 2, geo.y(i) + s / 2] : [ox + w * s + band / 2, geo.y(i) + s / 2];
    for (const side of ['n', 's', 'e', 'w']) (cl[side] || []).forEach((t, i) => { if (t == null) return; const [x, y] = cluePos(side, i); o.push(lab('clue', x, y, t, 'font-size="' + Math.round(s * 0.42) + '" data-t="clue" data-side="' + side + '" data-i="' + i + '"')); });
    for (let id = 0; id < w * h; id++) {
      const d = V.cell(id, f) || {}, x = geo.x(id % w), y = geo.y(Math.floor(id / w)), src = d.src;
      o.push('<g class="cellg' + (src && src.depth > 0 ? ' hyp' : '') + '" data-t="cell" data-id="' + id + '">');
      o.push('<rect class="c-bg ' + (d.bg || '') + '" x="' + x + '" y="' + y + '" width="' + s + '" height="' + s + '"/>');
      if (d.icon) o.push(icon(d.icon, x + s * 0.11, y + s * 0.11, s * 0.78));
      if (d.text != null) o.push('<text class="' + (d.textCls || 'val') + '" x="' + (x + s / 2) + '" y="' + (y + s / 2 + 1) + '" text-anchor="middle" dominant-baseline="central" font-size="' + Math.round(s * (d.small ? 0.34 : 0.5)) + '">' + esc(d.text) + '</text>');
      if (d.cands) { const k = Math.ceil(Math.sqrt(d.n || d.cands.length)), q = s / k; d.cands.forEach(cv => { const j = cv - 1; o.push('<text class="cand" x="' + (x + (j % k + 0.5) * q) + '" y="' + (y + (Math.floor(j / k) + 0.5) * q + 1) + '" text-anchor="middle" dominant-baseline="central" font-size="' + Math.max(8, Math.round(q * 0.62)) + '">' + cv + '</text>'); }); }
      if (d.corner != null) o.push('<text class="cand" x="' + (x + s - 4) + '" y="' + (y + s - 4) + '" text-anchor="end" font-size="' + Math.round(s * 0.3) + '">' + esc(d.corner) + '</text>');
      if (src && src.assumed) o.push('<rect class="assumed-box" x="' + (x + 2.5) + '" y="' + (y + 2.5) + '" width="' + (s - 5) + '" height="' + (s - 5) + '"/>');
      o.push('</g>');
    }
    if (V.regions) {
      const R = V.regions, seg = (x1, y1, x2, y2) => o.push('<line class="region" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>');
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        const id = r * w + c;
        if (c + 1 < w && R[id] !== R[id + 1]) seg(geo.x(c + 1), geo.y(r), geo.x(c + 1), geo.y(r + 1));
        if (r + 1 < h && R[id] !== R[id + w]) seg(geo.x(c), geo.y(r + 1), geo.x(c + 1), geo.y(r + 1));
      }
      o.push('<rect class="frame" x="' + ox + '" y="' + oy + '" width="' + w * s + '" height="' + h * s + '"/>');
    }
    if (V.overlay) o.push(V.overlay(f, geo, icon));
    if (V.edges) for (const e of V.edges) {
      const x1 = geo.cx(e.a), y1 = geo.cy(e.a), x2 = geo.cx(e.b), y2 = geo.cy(e.b), st = f.get(e.v);
      if (st && st.val) o.push('<line class="edge-on' + (st.depth > 0 ? ' hyp-edge' : '') + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>');
      else if (st && !st.auto) { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, q = s * 0.09; o.push('<path class="edge-x" d="M' + (mx - q) + ' ' + (my - q) + 'l' + 2 * q + ' ' + 2 * q + 'M' + (mx + q) + ' ' + (my - q) + 'l' + (-2 * q) + ' ' + 2 * q + '"/>'); }
      o.push('<line class="edge-hit" data-t="edge" data-v="' + e.v + '" x1="' + (x1 * 0.72 + x2 * 0.28) + '" y1="' + (y1 * 0.72 + y2 * 0.28) + '" x2="' + (x1 * 0.28 + x2 * 0.72) + '" y2="' + (y1 * 0.28 + y2 * 0.72) + '"/>');
    }
    if (a) {
      for (const id of a.cells || []) o.push('<rect class="scope-box" x="' + (geo.x(id % w) + 3) + '" y="' + (geo.y(Math.floor(id / w)) + 3) + '" width="' + (s - 6) + '" height="' + (s - 6) + '" rx="3"/>');
      const t = anchorAt || a.at;
      if (t && t.t === 'cell') o.push('<rect class="anchor-box" x="' + (geo.x(t.id % w) + 1.5) + '" y="' + (geo.y(Math.floor(t.id / w)) + 1.5) + '" width="' + (s - 3) + '" height="' + (s - 3) + '"/>');
      else if (t && t.t === 'col') o.push('<circle class="anchor-box" cx="' + (geo.x(t.i) + s / 2) + '" cy="9" r="9"/>');
      else if (t && t.t === 'row') o.push('<circle class="anchor-box" cx="10" cy="' + (geo.y(t.i) + s / 2) + '" r="9"/>');
      else if (t && t.t === 'clue') { const [x, y] = cluePos(t.side, t.i); o.push('<circle class="anchor-box" cx="' + x + '" cy="' + y + '" r="' + band * 0.46 + '"/>'); }
    }
    o.push('<g id="hl"></g><line id="dragline" class="drag-line" visibility="hidden"/></svg>');
    $('board').innerHTML = o.join('');
  }
  function highlight(vars, on) {
    const hl = document.getElementById('hl'); if (!hl) return;
    if (!on) { hl.innerHTML = ''; return; }
    const w = G.view.w, s = geo.s, ids = new Set();
    vars.forEach(v => [].concat(G.cellOf(v)).forEach(id => ids.add(id)));
    hl.innerHTML = [...ids].map(id => '<rect class="hl-box" x="' + (geo.x(id % w) + 1.5) + '" y="' + (geo.y(Math.floor(id / w)) + 1.5) + '" width="' + (s - 3) + '" height="' + (s - 3) + '"/>').join('');
  }

  // ---------- tools, hint, proof ----------
  function buildMarks() {
    const box = $('marks'); box.textContent = '';
    box.appendChild(el('span', null, 'Mark as'));
    if (G.digits) {
      for (let d = 0; d < G.digits; d++) { const b = el('button', 'digit', d + 1); b.dataset.d = d; b.onclick = () => { digit = d; render(); }; box.appendChild(b); }
      box.appendChild(el('span', 'note', 'Left click sets the number. Right click rules it out.'));
    } else {
      for (let i = 0; i < 2; i++) { const b = el('button'); b.dataset.i = i; b.onclick = () => { mark = i; render(); }; box.appendChild(b); }
    }
  }
  function renderMarks() {
    for (const b of $('marks').querySelectorAll('button')) {
      if (G.digits) b.classList.toggle('on', +b.dataset.d === digit);
      else { const i = +b.dataset.i; b.classList.toggle('on', i === mark); b.textContent = G.tools[i] + ' (' + (i === mark ? 'left' : 'right') + ' click)'; }
    }
  }
  function renderHint(f) {
    const h = $('hint'); h.textContent = ''; h.hidden = !!demo;
    if (demo) return;
    const blk = proof.path().slice(-1)[0];
    const st = proof.status();
    if (st === 'refuted') return void h.appendChild(el('div', 'rule', G.refutedText || 'The rules cannot all hold.'));
    if (blk.closed) return void h.appendChild(el('div', 'rule', 'This case is closed by a contradiction. Click another case in the proof, or press "End cases".'));
    if (mode === 'suppose') return void h.appendChild(el('div', 'rule', G.digits ? 'Click an undecided cell to assume it holds the selected number. Right-click to assume it does not.' : 'Click to assume: left click for ' + G.tools[mark].toLowerCase() + ', right click for ' + G.tools[1 - mark].toLowerCase() + '.'));
    if (mode === 'split') return void h.appendChild(el('div', 'rule', 'Click an undecided cell to split into cases, one for each thing it could be.'));
    if (!anchor) return void h.appendChild(el('div', 'rule', G.howToCite || 'Click a clue to cite it as your reason.'));
    const a = G.anchor(anchor);
    h.appendChild(el('div', 'rule', 'Rule: ' + a.rule));
    const keys = anchorAt ? (G.anchorsAt(anchorAt, f) || []) : [];
    if (keys.length > 1) h.appendChild(el('div', 'more', 'Rule ' + (keys.indexOf(anchor) + 1) + ' of ' + keys.length + ' at this place. Click it again for the next one.'));
    h.appendChild(el('div', null, a.how || 'Now mark something this rule forces.'));
    const acts = el('div', 'acts');
    const btn = (label, fn) => { const x = el('button', null, label); x.onclick = fn; acts.appendChild(x); };
    btn('Cases from this rule', act(() => proof.casesAnchor(anchor), () => { anchor = null; anchorAt = null; say('Cases opened, one for each remaining choice. Click a case to work in it.', 'ok'); }));
    btn('This rule is broken', act(() => proof.contradiction(anchor), () => { anchor = null; anchorAt = null; say('Contradiction accepted.', 'ok'); }));
    h.appendChild(acts);
  }
  function renderProof(path) {
    const root = $('proof'); root.textContent = '';
    let n = 0;
    const active = path[path.length - 1];
    const line = (text, why, vars) => {
      const d = el('div', 'ln'); d.appendChild(el('span', 'n', ++n + '.')); d.appendChild(el('span', null, text));
      if (why) d.appendChild(el('span', 'why', why));
      if (vars) { d.onmouseenter = () => highlight(vars, true); d.onmouseleave = () => highlight(vars, false); }
      return d;
    };
    const closedLine = b => el('div', 'bot', 'Contradiction: ' + (b.closed.byCases ? 'every case ended in a contradiction' : brokenText(b.closed.anchor)));
    const box = (b, title) => {
      const d = el('div', 'box' + (b === active ? ' active' : '') + (b.closed ? ' shut' : ''));
      d.appendChild(el('div', 'head', title));
      block(b, d);
      if (b.closed) d.appendChild(closedLine(b));
      else if (!b.items.length) d.appendChild(el('div', 'empty', b === active ? 'Deduce here…' : 'Click to work in this case'));
      d.onclick = e => { e.stopPropagation(); if (!demo && proof.select(b)) { anchor = null; anchorAt = null; say(null); render(); } };
      return d;
    };
    function block(b, into) {
      for (const it of b.items) {
        if (it.type === 'step') into.appendChild(line(marksText(it.marks), G.anchor(it.anchor).text, it.marks.map(m => m[0])));
        else if (it.type === 'suppose') {
          const a = it.block.assume;
          into.appendChild(box(it.block, 'Assume ' + one(a[0], a[1])));
          if (it.block.closed) into.appendChild(line(one(a[0], 1 - a[1]), 'the assumption led to a contradiction', [a[0]]));
        } else {
          into.appendChild(el('div', 'caseshead', 'Cases: ' + (it.src.anchor ? G.anchor(it.src.anchor).text : one(it.src.v, 1) + ', or not')));
          const row = el('div', 'branches');
          it.branches.forEach((br, k) => row.appendChild(box(br, 'Case ' + (k + 1) + ': ' + one(br.assume[0], br.assume[1]))));
          into.appendChild(row);
          if (it.ended && it.exports.length) into.appendChild(line(marksText(it.exports), 'true in every open case', it.exports.map(m => m[0])));
        }
      }
    }
    block(proof.root, root);
    if (proof.root.closed) root.appendChild(closedLine(proof.root));
    if (!proof.root.items.length && !proof.root.closed) root.appendChild(el('div', 'empty', 'No steps yet. Click a clue on the board to start.'));
    const box0 = root.querySelector('.box.active');
    root.scrollTop = root.scrollHeight;
    if (box0) { const pr = root.getBoundingClientRect(), r2 = box0.getBoundingClientRect(); if (r2.bottom < pr.top + 40 || r2.bottom > pr.bottom) root.scrollTop += r2.bottom - pr.bottom + 10; }
  }
  function fitProof() {
    const col = document.querySelector('.right');
    col.style.maxHeight = innerWidth <= 520 ? '' : Math.max(220, innerHeight - col.getBoundingClientRect().top - 12) + 'px';
  }
  function render() {
    if (!G) return;
    const path = proof.path(), f = proof.facts();
    if (anchor && !G.anchor(anchor)) { anchor = null; anchorAt = null; }
    renderBoard(f); renderHint(f); renderMarks(); fitProof(); renderProof(path);
    $('demo').hidden = !demo; $('tools').style.visibility = demo ? 'hidden' : '';
    for (const m of ['deduce', 'suppose', 'split']) $('m-' + m).classList.toggle('on', mode === m);
    $('undo').disabled = !!demo || !proof.hist.length;
    $('endcases').disabled = !!demo || !proof.inCases();
    $('discard').disabled = !!demo || path.length < 2;
    const item = path.length > 1 ? path[path.length - 2].items.slice(-1)[0] : null;
    $('discard').textContent = item && item.type === 'cases' ? 'Discard cases' : 'Discard assumption';
    for (const id of ['pick', 'restart', 'copystate']) $(id).disabled = !!demo;
    $('show-demo').hidden = !game.demo || !!demo;
    const m = $('msg'); m.textContent = msg ? msg.text : ''; m.className = msg ? msg.kind : '';
    const st = demo ? null : proof.status();
    $('solved').style.display = st ? 'block' : 'none';
    $('solved-text').textContent = winText(st);
    if (st && !wasSolved) { celebrate(); openWin(st); }
    wasSolved = !!st;
    store();
  }
  const winText = st => st === 'refuted' ? (G.refutedText || 'Solved! The rules cannot all hold.') : (G.solvedText || 'Solved! Every mark was forced by a rule, so this is the only solution.');

  // ---------- win popup and fireworks ----------
  function openWin(st) {
    $('win-text').textContent = winText(st || proof.status()).replace(/^Solved! /, '');
    $('win-pick').selectedIndex = pi < defs.length - 1 ? pi + 1 : 0;
    $('win').classList.add('show'); $('win-start').focus();
  }
  function closeWin() { $('win').classList.remove('show'); }
  function stopFx() { fxRun++; const cv = $('fx'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); }
  let fxRun = 0;
  function celebrate() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const run = ++fxRun;   // a newer show replaces an older one
    const cv = $('fx'), ctx = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    const colors = ['#f2a900', '#ff5a5f', '#4cc9f0', '#7ae582', '#c77dff', '#ffffff'], ROCKETS = 14, big = Math.min(W, H) / dpr / 700 + 0.6;
    let parts = [], rockets = [], launched = 0, last = performance.now();
    const launch = () => rockets.push({ x: W * (0.15 + 0.7 * Math.random()), y: H, vy: -H * (1.0 + 0.4 * Math.random()), top: H * (0.15 + 0.3 * Math.random()), c: colors[launched++ % colors.length] });
    const burst = r => {
      const second = colors[(colors.indexOf(r.c) + 2) % colors.length];
      for (let i = 0; i < 170; i++) {
        const a = Math.random() * 6.283, ring = i % 3 === 0, sp = (ring ? 430 : 90 + Math.random() * 380) * dpr * big;
        parts.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, size: ring ? 3.4 : 2.6, c: Math.random() < 0.15 ? '#ffffff' : ring ? second : r.c });
      }
    };
    const tick = now => {
      if (run !== fxRun) return;
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      if (launched < ROCKETS && Math.random() < dt * 12) launch();
      ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      rockets = rockets.filter(r => { r.y += r.vy * dt; ctx.fillStyle = r.c; ctx.fillRect(r.x - 1.5 * dpr, r.y, 3 * dpr, 16 * dpr); if (r.y <= r.top) { burst(r); return false; } return true; });
      parts = parts.filter(p => { p.vy += 220 * dpr * dt; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.55;
        if (p.life <= 0) return false; ctx.globalAlpha = p.life; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * dpr, 0, 6.283); ctx.fill(); return true; });
      ctx.globalAlpha = 1;
      if (launched < ROCKETS || rockets.length || parts.length) requestAnimationFrame(tick); else ctx.clearRect(0, 0, W, H);
    };
    launch(); requestAnimationFrame(tick);
  }

  // ---------- wiring ----------
  function targetOf(e) {
    const t = e.target.closest('[data-t]'); if (!t) return null;
    const d = t.dataset;
    return d.t === 'cell' ? { t: 'cell', id: +d.id } : d.t === 'edge' ? { t: 'edge', v: +d.v } : d.t === 'clue' ? { t: 'clue', side: d.side, i: +d.i } : { t: d.t, i: +d.i };
  }
  let down = null, dragged = false;
  const board = $('board');
  board.addEventListener('pointerdown', e => { if (e.button === 0) { down = targetOf(e); dragged = false; } });
  board.addEventListener('pointermove', e => {
    if (!down || down.t !== 'cell' || !G || !G.drag) return;
    const dl = document.getElementById('dragline'), box = board.querySelector('svg').getBoundingClientRect();
    dl.setAttribute('x1', geo.cx(down.id)); dl.setAttribute('y1', geo.cy(down.id)); dl.setAttribute('x2', e.clientX - box.left); dl.setAttribute('y2', e.clientY - box.top);
    dl.setAttribute('visibility', 'visible');
  });
  window.addEventListener('pointerup', e => {
    const from = down; down = null;
    const dl = document.getElementById('dragline'); if (dl) dl.setAttribute('visibility', 'hidden');
    if (!from || e.button !== 0 || !G) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY), to = hit && board.contains(hit) ? targetOf({ target: hit }) : null;
    if (to && from.t === 'cell' && to.t === 'cell' && to.id !== from.id) { dragged = true; onDrag(from.id, to.id); }
  });
  board.addEventListener('click', e => { if (dragged) { dragged = false; return; } const t = targetOf(e); if (t) onTarget(t, false); });
  board.addEventListener('contextmenu', e => { const t = targetOf(e); if (t) { e.preventDefault(); onTarget(t, true); } });
  for (const m of ['deduce', 'suppose', 'split']) $('m-' + m).onclick = () => { mode = mode === m ? 'deduce' : m; anchor = null; anchorAt = null; say(null); render(); };
  $('undo').onclick = act(() => proof.undo());
  $('discard').onclick = act(() => proof.discard(), 'Discarded.');
  $('endcases').onclick = act(() => proof.endCases(), r => say(r.open === 1 ? 'Only one case is still open, so everything in it holds.' : 'Kept what agrees in every open case.', 'ok'));
  $('restart').onclick = () => load(pi, true);
  $('pick').onchange = () => load($('pick').selectedIndex);
  $('to-home').onclick = showHome;
  $('show-demo').onclick = () => startDemo(pi);
  $('demo-next').onclick = demoNext;
  $('demo-skip').onclick = endDemo;
  $('next').onclick = () => openWin();
  $('win-close').onclick = closeWin;
  $('win').addEventListener('click', e => { if (e.target === $('win')) closeWin(); });
  $('win-start').onclick = () => { const i = $('win-pick').selectedIndex; closeWin(); load(i); window.scrollTo(0, 0); };
  function stateText() {
    const f = proof.facts(), known = [];
    for (const [v, x] of f) if (!x.given) known.push(one(v, x.val) + (x.auto ? ' (auto)' : ''));
    return JSON.stringify({ game: game.id, puzzle: defs[pi].id, title: defs[pi].title, definition: defs[pi], cited: anchor ? G.anchor(anchor).text : null,
      message: msg ? msg.text : null, known, proof: proof.root }, null, 1);
  }
  $('copystate').onclick = () => {
    const text = stateText(), done = () => { say('State copied. Paste it into a message to report a problem.', 'ok'); render(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => window.prompt('Copy this:', text));
    else window.prompt('Copy this:', text);
  };
  window.addEventListener('resize', render);
  window.addEventListener('scroll', () => { if (G) fitProof(); }, { passive: true });
  document.addEventListener('keydown', e => {
    if (!G) return;
    if (e.key === 'Escape') { if ($('win').classList.contains('show')) return closeWin(); anchor = null; anchorAt = null; mode = 'deduce'; say(null); return render(); }
    if (G.digits && /^[1-9]$/.test(e.key) && +e.key <= G.digits) { digit = +e.key - 1; render(); }
  });
  const UIKEY = 'puzzle-proofs:sections';
  let sections = {};
  try { sections = JSON.parse(localStorage.getItem(UIKEY)) || {}; } catch (e) { /* defaults */ }
  for (const d of document.querySelectorAll('details[id]')) {
    if (d.id in sections) d.open = sections[d.id];
    d.addEventListener('toggle', () => { sections[d.id] = d.open; try { localStorage.setItem(UIKEY, JSON.stringify(sections)); } catch (e) { /* not saved */ } });
  }
  const foot = 'Puzzles are from the <a href="https://github.com/Bram-Hub/LEGUP">LEGUP</a> sample files where LEGUP has them, and generated otherwise. Code and puzzles are released under the <a href="' + REPO + '/blob/main/LICENSE">GNU GPL-3.0</a>. <a href="' + REPO + '">Source on GitHub</a>.';
  $('foot-home').innerHTML = foot; $('foot-play').innerHTML = foot;

  window.LUI = { get G() { return G; }, get proof() { return proof; }, get demo() { return demo; }, render, openGame, showHome, stateText, onTarget, onDrag };
  const last = readAll().last;
  if (last && LG.games[last.game] && (LG.puzzles[last.game] || []).length) openGame(last.game, last.puzzle); else showHome();
})();
