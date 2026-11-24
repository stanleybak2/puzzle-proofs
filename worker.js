// Runs board checks and generation off the page's main thread, so the page stays
// responsive and a search that runs too long can be stopped outright.
self.window = self;
importScripts('core.js', 'games/lightup.js', 'games/counting.js', 'games/numbers.js', 'games/treetent.js', 'games/regions.js', 'games/masyu.js', 'games/truthtable.js', 'gen.js');
self.onmessage = e => {
  const m = e.data; let res;
  try { res = m.cmd === 'rate' ? LG.rate(m.game, m.def, m.ms) : m.cmd === 'generate' ? LG.generate(m.game, m.n, m.want, m.ms) : { error: 'unknown command' }; }
  catch (err) { res = { error: String((err && err.message) || err) }; }
  self.postMessage({ id: m.id, res });
};
