"""Tests for imgsim_lib.py and publish_manifest.py (no numpy, no model). Run by scripts/test_imgsim.mjs:
python -I scripts/imgsim/test_imgsim_lib.py REPO
"""
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile

REPO = os.path.abspath(sys.argv[1])
HERE = os.path.join(REPO, 'scripts', 'imgsim')
sys.path.insert(0, HERE)
import imgsim_lib as L  # noqa: E402

B32, B16 = L.LEGACY_MODEL, L.PREFERRED_MODEL

# --- registry: installed apps know the B/32 names; the workflow derives "<id>.tflite" from MODEL_IDS
assert L.MODELS[B32]['file'] == 'siglip2-b32-256-wi8.tflite'
assert L.MODELS[B32]['vectors'] == 'imgsim-vectors.bin'
assert L.MODELS[B32]['meta'] == 'model.json'
for mid, spec in L.MODELS.items():
    assert spec['file'] == mid + '.tflite', mid
assert len({s['vectors'] for s in L.MODELS.values()}) == len(L.MODELS), 'each model has its own vectors file'
with open(os.path.join(REPO, '.github', 'workflows', 'imgsim.yml'), encoding='utf-8') as f:
    wf = f.read()
assert re.search(r'MODEL_IDS: "([^"]+)"', wf).group(1).split() == list(L.MODELS), 'workflow MODEL_IDS = MODELS'
assert re.search(r'cron: "\d+ \d+ \* \* \*"', wf), 'vectors are rebuilt daily'
assert '--budget-min' in wf and 'upload.txt' in wf
with open(os.path.join(HERE, 'build_vectors.py'), encoding='utf-8') as f:
    gap = float(re.search(r'HOST_GAP_S = ([\d.]+)', f.read()).group(1))
assert gap >= 1.1, 'AGENTS.md: at least 1.1 s between requests to one host'

# --- which images are indexed
kit = lambda kid, main=None, gal=(), **kw: dict(kit_id=kid, images={'box_art_url': main} if main else {},
                                               gallery_image_urls=list(gal), **kw)
split = {
    'gundam': [kit('g1', 'https://a/1.jpg', ['https://a/1.jpg', 'https://a/2.jpg']), kit('g2', 'https://a/3.jpg')],
    'fate': [
        kit('f1', None, ['./assets/catalog/fate/f1-01.jpg', './assets/catalog/fate/f1-02.jpg', 'https://x/3.jpg']),
        kit('f2', './assets/catalog/fate/f2.jpg', goods_kind='ticket'),
        kit('f3', None, []),
    ],
    'beyblade': [kit('b1', 'https://b/1.png', ['https://b/2.png'])],
    'lego': [kit('l1', 'https://c/1.jpg')],
}
rows = L.gallery_rows(split, {'g2': {'url': 'https://box/g2.jpg'}, 'g1': {'url': 'https://a/1.jpg'}})
assert rows == [
    ('g1', 'https://a/1.jpg', 0),  # box art = cover → no 2nd row, remote gallery images are not added
    ('g2', 'https://a/3.jpg', 0),
    ('g2', 'https://box/g2.jpg', 0),  # atlas box art
    ('f1', './assets/catalog/fate/f1-01.jpg', 2),  # first gallery image as cover
    ('f1', './assets/catalog/fate/f1-02.jpg', 2),  # 2nd local gallery image
    ('b1', 'https://b/1.png', 4),
], rows
assert L.FRANCHISES.index('fate') == 2 and 'lego' not in L.FRANCHISES

# --- rows of the new file: current images first, a kit whose new image is not read yet keeps its previous rows
assert L.resolve_aliases({'a': 'b', 'b': 'c', 'x': 'y'}) == {'a': 'c', 'b': 'c', 'x': 'y'}
assert L.resolve_aliases({'a': 'b', 'b': 'a'})['a'] in ('a', 'b'), 'a loop ends'
got = {'https://a/1.jpg': (0.5, b'\x01'), 'https://a/3.jpg': (0.25, b'\x02')}
prev = {'g2': [('oldg2', 0.75, b'\x09')], 'f1': [('oldf1a', 1.0, b'\x07'), ('oldf1b', 1.0, b'\x08')], 'gone': [('z', 1, b'')]}
ids_, src_, fr_, sc_, vec_, kept = L.assemble(rows, got.get, prev)
assert ids_ == ['g1', 'g2', 'f1', 'f1'] and kept == 1, (ids_, kept)
assert src_ == [L.src_hash('https://a/1.jpg'), L.src_hash('https://a/3.jpg'), 'oldf1a', 'oldf1b'], 'g2: box art not read'
assert fr_ == [0, 0, 2, 2] and sc_ == [0.5, 0.25, 1.0, 1.0] and vec_ == [b'\x01', b'\x02', b'\x07', b'\x08']
assert L.assemble(rows, got.get, {})[0] == ['g1', 'g2'] and L.assemble(rows, got.get, {})[5] == 0

# --- URLs urllib can open
assert L.fetch_url('https://shop.example/20231013/104919/꼬부기 썸네일.png') == \
    'https://shop.example/20231013/104919/%EA%BC%AC%EB%B6%80%EA%B8%B0%20%EC%8D%B8%EB%84%A4%EC%9D%BC.png'
assert L.fetch_url('https://a.example/x%20y.jpg?w=1&h=2') == 'https://a.example/x%20y.jpg?w=1&h=2', 'escapes kept'
assert L.fetch_url('https://bandai-a.akamaihd.net/bc/img/model/b/1000174011_1.jpg') == \
    'https://bandai-a.akamaihd.net/bc/img/model/b/1000174011_1.jpg'
assert L.src_hash('https://a/1.jpg') == L.src_hash('https://a/1.jpg') and len(L.src_hash('x')) == 10

# --- vectors file: HAIS v1 as installed apps parse it (version byte 1, JSON padded to 4, f32 scales, i8 rows)
dim = 4
vec = lambda *xs: struct.pack(f'{len(xs)}b', *xs)
ids, src, fr = ['g1', 'g2', 'g2'], ['aaaaaaaaaa', 'bbbbbbbbbb', 'cccccccccc'], [0, 0, 0]
scales, vecs = [0.5, 0.25, 1.0], [vec(1, 2, 3, 4), vec(-1, 0, 127, -127), vec(0, 0, 0, 1)]
data = L.pack_vectors(B32, '2026-11-14T00:00:00Z', dim, ids, src, fr, scales, vecs)
assert data[:5] == b'HAIS\x01'
d, n, jl = struct.unpack_from('<III', data, 8)
assert (d, n, jl % 4) == (4, 3, 0) and len(data) == 20 + jl + 4 * n + n * d
meta, d2, s2, v2 = L.unpack_vectors(data)
assert meta['model'] == B32 and meta['ids'] == ids and meta['src'] == src
assert meta['franchises'] == L.FRANCHISES and meta['fr'] == fr
assert d2 == dim and s2 == scales and v2 == vecs

# --- an unchanged index keeps its bytes (and sha256); any change gets the new time
same, changed = L.pack_stable(data, B32, '2026-11-20T00:00:00Z', dim, ids, src, fr, scales, vecs)
assert same == data and not changed
moved, changed = L.pack_stable(data, B32, '2026-11-20T00:00:00Z', dim, ids[:2], src[:2], fr[:2], scales[:2], vecs[:2])
assert changed and L.unpack_vectors(moved)[0]['updated'] == '2026-11-20T00:00:00Z'
_, changed = L.pack_stable(None, B32, 'now', dim, ids, src, fr, scales, vecs)
assert changed
_, changed = L.pack_stable(b'junk', B32, 'now', dim, ids, src, fr, scales, vecs)
assert changed
try:
    L.unpack_vectors(data[:-1])
    raise AssertionError('a cut file must not parse')
except ValueError:
    pass

# --- manifests
model_meta = lambda mid: dict(id=mid, file=L.MODELS[mid]['file'], bytes=1, arch=L.MODELS[mid]['arch'],
                              pretrained='webli', output=dict(dim=768, normalised=True))
vec_info = lambda kits, sha='v' * 64: dict(bytes=100, sha256=sha, rows=kits + 1, kits=kits, updated='2026-11-14T00:00:00Z',
                                           coverage=round(kits / 1000, 4), kits_by_franchise={'gundam': kits})
models = {B32: (model_meta(B32), dict(bytes=95728976, sha256='m' * 64)), B16: (model_meta(B16), dict(bytes=9, sha256='n' * 64))}
v1, v2 = L.build_manifests(models, {B32: vec_info(900), B16: vec_info(450)})
assert v1['schema'] == 1 and set(v1) == {'schema', 'model', 'vectors'}
assert set(v1['vectors']) == {'file', 'url', 'bytes', 'sha256', 'rows', 'kits', 'updated', 'model'}, 'old apps: same fields'
assert v1['model']['file'] == 'siglip2-b32-256-wi8.tflite' and v1['model']['sha256'] == 'm' * 64 and 'id' not in v1['model']
assert v1['model']['url'] == L.RELEASE_URL + 'siglip2-b32-256-wi8.tflite'
assert v1['vectors']['file'] == 'imgsim-vectors.bin' and v1['vectors']['model'] == B32
assert v2['schema'] == 2 and v2['franchises'] == L.FRANCHISES
assert [m['id'] for m in v2['models']] == [B32, B16]
assert v2['default'] == B32, 'B/16 is not the default while its vectors are half done'
b16 = v2['models'][1]
assert b16['file'] == 'siglip2-b16-256-wi8.tflite' and b16['vectors']['file'] == 'imgsim-vectors-siglip2-b16-256-wi8.bin'
assert b16['vectors']['model'] == B16 and b16['vectors']['coverage'] == 0.45 and b16['output']['dim'] == 768
_, v2 = L.build_manifests(models, {B32: vec_info(900), B16: vec_info(882)})
assert v2['default'] == B16, 'B/16 holds 98 % of the kits B/32 holds (not of the gallery: some hosts refuse)'
_, v2 = L.build_manifests(models, {B32: vec_info(900), B16: vec_info(881)})
assert v2['default'] == B32
_, v2 = L.build_manifests({B32: models[B32]}, {B32: vec_info(900), B16: vec_info(900)})
assert [m['id'] for m in v2['models']] == [B32] and v2['default'] == B32, 'a model without its file is not listed'
v1, v2 = L.build_manifests({B16: models[B16]}, {B16: vec_info(450)})
assert v1 is None and v2['default'] == B16
assert L.build_manifests({}, {}) == (None, None)

# --- publish_manifest.py: what gets uploaded, and nothing on a quiet day
tmp = tempfile.mkdtemp(prefix='imgsim-test-')
try:
    rel, out = os.path.join(tmp, 'rel'), os.path.join(tmp, 'out')
    os.makedirs(rel)
    os.makedirs(out)

    def put(path, data):
        with open(path, 'wb') as f:
            f.write(data)

    put(os.path.join(rel, 'siglip2-b32-256-wi8.tflite'), b'model-b32')
    put(os.path.join(rel, 'model.json'), json.dumps(dict(file='siglip2-b32-256-wi8.tflite', arch='x')).encode())
    put(os.path.join(rel, 'imgsim-vectors.bin'), b'old vectors')
    put(os.path.join(rel, 'imgsim.json'), b'{"schema": 1}')
    put(os.path.join(rel, 'siglip2-b16-256-wi8.tflite'), b'model-b16')
    put(os.path.join(rel, 'siglip2-b16-256-wi8.model.json'), json.dumps(model_meta(B16)).encode())
    summary = dict(rows=3, kits=2, updated='2026-11-14T00:00:00Z', coverage=1.0, kits_by_franchise={'gundam': 2})
    for mid in (B32, B16):
        put(os.path.join(out, L.MODELS[mid]['vectors']), data)
        put(os.path.join(out, L.MODELS[mid]['vectors'] + '.summary.json'), json.dumps(summary).encode())

    def publish():
        r = subprocess.run([sys.executable, '-I', '-B', os.path.join(HERE, 'publish_manifest.py'), rel, out],
                           capture_output=True, text=True)
        assert r.returncode == 0, r.stderr
        with open(os.path.join(out, 'upload.txt'), encoding='utf-8') as f:
            return [os.path.basename(p) for p in f.read().split('\n') if p]

    assert publish() == ['imgsim-vectors.bin', 'imgsim-vectors-siglip2-b16-256-wi8.bin', 'imgsim-v2.json', 'imgsim.json']
    with open(os.path.join(out, 'imgsim.json'), encoding='utf-8') as f:
        m1 = json.load(f)
    assert m1['model']['sha256'] == hashlib.sha256(b'model-b32').hexdigest() and m1['model']['bytes'] == 9
    with open(os.path.join(out, 'imgsim-v2.json'), encoding='utf-8') as f:
        m2 = json.load(f)
    assert m2['default'] == B16 and m2['models'][0]['id'] == B32
    for name in ('imgsim-vectors.bin', 'imgsim-vectors-siglip2-b16-256-wi8.bin', 'imgsim-v2.json', 'imgsim.json'):
        shutil.copy(os.path.join(out, name), os.path.join(rel, name))
    assert publish() == [], 'nothing changed → nothing uploaded'
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print('test_imgsim_lib: ok')
