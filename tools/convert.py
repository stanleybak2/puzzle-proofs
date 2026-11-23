"""Convert LEGUP sample puzzle files to the puzzle definitions used here.

usage: python3 convert.py "<LEGUP repo>/puzzles files" raw.js

Writes every readable puzzle to raw.js as LG.raw[game] = [...]. The audit page
(audit.html) then checks each one for a unique solution, and select.py keeps
the ones that pass.
"""
import glob, json, os, re, sys

src, out = sys.argv[1], sys.argv[2]


def cells(text):
    return [(int(v), int(x), int(y)) for v, x, y in re.findall(r'<cell value="(-?\d+)" x="(\d+)" y="(\d+)"', text)]


def dims(text):
    m = re.search(r'height="(\d+)" width="(\d+)"', text)
    if m:
        return int(m[1]), int(m[2])
    m = re.search(r'board[^>]*size="(\d+)"', text)
    return int(m[1]), int(m[1])


def char_grid(text, sym, blank='.'):
    h, w = dims(text)
    g = [[blank] * w for _ in range(h)]
    for v, x, y in cells(text):
        if sym(v) is not None:
            g[y][x] = sym(v)
    return [''.join(r) for r in g]


def lightup(t):
    return {'grid': char_grid(t, lambda v: '#' if v < 0 else str(v))}


def fillapix(t):
    return {'grid': char_grid(t, lambda v: str(v) if 0 <= v <= 9 else None)}


def minesweeper(t):
    return {'grid': char_grid(t, lambda v: str(v) if 0 <= v <= 8 else None)}


def binary(t):
    return {'grid': char_grid(t, lambda v: str(v) if v in (0, 1) else None)}


def sudoku(t):
    return {'grid': char_grid(t, lambda v: str(v) if 1 <= v <= 9 else None)}


def nurikabe(t):
    h, w = dims(t)
    g = [[0] * w for _ in range(h)]
    for v, x, y in cells(t):
        if v > 0:
            g[y][x] = v
    return {'grid': g}


def masyu(t):
    return {'grid': char_grid(t, lambda v: {1: 'B', 2: 'W'}.get(v))}


def axis(t, side):
    m = re.search(r'<axis side="%s">(.*?)</axis>' % side, t, re.S)
    return re.findall(r'<clue index="([^"]+)" value="(-?\d+)"', m[1])


def treetent(t):
    return {'grid': char_grid(t, lambda v: 'T' if v == 1 else None),
            'rows': [int(v) for _, v in axis(t, 'east')], 'cols': [int(v) for _, v in axis(t, 'south')]}


def skyscrapers(t):
    east, south = axis(t, 'east'), axis(t, 'south')
    n, _ = dims(t)
    d = {'n': n, 'clues': {'w': [int(i) for i, _ in east], 'e': [int(v) for _, v in east],
                           'n': [int(i) for i, _ in south], 's': [int(v) for _, v in south]}}
    given = [(v, x, y) for v, x, y in cells(t) if v > 0]
    if given:
        d['given'] = given
    return d


def starbattle(t):
    n, _ = dims(t)
    g = [['?'] * n for _ in range(n)]
    for i, reg in enumerate(re.findall(r'<region>(.*?)</region>', t, re.S)):
        for _, x, y in cells(reg):
            g[y][x] = chr(65 + i)
    m = re.search(r'puzzle_num="(\d+)"', t)
    return {'stars': int(m[1]) if m else 1, 'regions': [''.join(r) for r in g]}


def thermometer(t):
    h, w = dims(t)
    vials = []
    for hx, hy, tx, ty in re.findall(r'<vial headx="(\d+)" heady="(\d+)" tailx="(\d+)" taily="(\d+)"', t):
        hx, hy, tx, ty = int(hx), int(hy), int(tx), int(ty)
        dx, dy = (tx > hx) - (tx < hx), (ty > hy) - (ty < hy)
        v, x, y = [], hx, hy
        while True:
            v.append(y * w + x)
            if (x, y) == (tx, ty):
                break
            x, y = x + dx, y + dy
        vials.append(v)
    return {'w': w, 'h': h, 'vials': vials,
            'rows': [int(v) for v in re.findall(r'<row value="(\d+)"', t)], 'cols': [int(v) for v in re.findall(r'<col value="(\d+)"', t)]}


GAMES = {'lightup': lightup, 'fillapix': fillapix, 'minesweeper': minesweeper, 'binary': binary, 'sudoku': sudoku,
         'nurikabe': nurikabe, 'masyu': masyu, 'treetent': treetent, 'skyscrapers': skyscrapers,
         'starbattle': starbattle, 'thermometer': thermometer}

raw = {}
for game, fn in GAMES.items():
    raw[game] = []
    for f in sorted(glob.glob(os.path.join(src, game, '**', '*'), recursive=True)):
        if not os.path.isfile(f) or 'Goal Conditions' in f:
            continue
        try:
            d = fn(open(f, encoding='utf-8', errors='replace').read())
        except Exception as e:  # unreadable or malformed sample file
            print('skip', f, e)
            continue
        rel = os.path.relpath(f, os.path.join(src, game))
        d['id'] = re.sub(r'\.xml$', '', os.path.basename(f))
        d['set'] = os.path.dirname(rel) or re.sub(r'\.xml$', '', os.path.basename(f))
        raw[game].append(d)
    print(game, len(raw[game]))

with open(out, 'w') as fh:
    fh.write('// Every LEGUP sample puzzle that could be read, before checking. Written by tools/convert.py.\n')
    fh.write('LG.raw = ' + json.dumps(raw, separators=(',', ':')) + ';\n')
