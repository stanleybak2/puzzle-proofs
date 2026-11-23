"""Write puzzles/all.js from tools/selected.json.

selected.json is saved from dev.html. It holds the LEGUP sample puzzles that
passed the checks, the generated puzzles, and one small demo puzzle per game.
"""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(here, 'selected.json')))
ORDER = ['lightup', 'sudoku', 'binary', 'fillapix', 'minesweeper', 'starbattle', 'thermometer', 'skyscrapers',
         'treetent', 'battleship', 'nurikabe', 'heyawake', 'masyu', 'truthtable']
DROP = ('set', 'seed', 'src', 'size')
out = {}
for game in ORDER:
    items = []
    for src in ('made', 'legup'):
        for d in data[src].get(game, []):
            d = dict(d); d['from'] = 'LEGUP' if src == 'legup' else 'generated'
            items.append(d)
    area = lambda d: eval(d['size'].replace('x', '*'))
    if game != 'truthtable':   # the truth table puzzles keep their written order
        items.sort(key=lambda d: (d['level'] != 'direct', area(d)))
    seen, count, res = set(), {}, []
    for d in items:
        key = json.dumps({k: v for k, v in d.items() if k not in DROP + ('id', 'title', 'from', 'level')}, sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        if 'title' not in d:
            label = d['size'] + (' easy' if d['level'] == 'direct' else ' harder')
            count[label] = count.get(label, 0) + 1
            d['title'] = '%s %d' % (label, count[label])
        d['id'] = str(d.get('id') or 'g%s-%s' % (d['size'], d.get('seed')))
        res.append({k: v for k, v in d.items() if k not in DROP})
    out[game] = res
with open(os.path.join(here, '..', 'puzzles', 'all.js'), 'w') as fh:
    fh.write('// Written by tools/build_puzzles.py. Every puzzle here was checked to have exactly one solution\n')
    fh.write('// (for Short Truth Table: no solution, or exactly one). "from" says where it came from.\n')
    fh.write('LG.order = ' + json.dumps(ORDER) + ';\n')
    fh.write('LG.puzzles = {\n')
    for game in ORDER:
        fh.write(' ' + json.dumps(game) + ': [\n')
        for d in out[game]:
            fh.write('  ' + json.dumps(d, separators=(',', ':'), ensure_ascii=False) + ',\n')
        fh.write(' ],\n')
    fh.write('};\n')
    fh.write('// Small puzzles for the first-run demos.\n')
    for game, d in data['demos'].items():
        d = {k: v for k, v in d.items() if k not in DROP + ('level',)}
        d.update(id='demo', title='Demo')
        fh.write('LG.games[%s].demo = %s;\n' % (json.dumps(game), json.dumps(d, separators=(',', ':'))))
for game in ORDER:
    print(game, len(out[game]), [d['title'] for d in out[game]][:4], '...')
