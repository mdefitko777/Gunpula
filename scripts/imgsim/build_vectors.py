"""Hobby Atlas "생김새로 찾기" — embed every catalog product's official image(s) with the same LiteRT model the app
runs, and write one compact file the app downloads (imgsim-vectors.bin).

Per product (data/split/kits-*.json): the cover (images.box_art_url, else the first gallery image) and, when different,
the atlas box art (data/atlas/gundam-boxart.json) or the 2nd local gallery image. The box art lets a photo of a box
front find its kit; the app keeps the best of a product's rows.

Incremental: rows whose (kit_id, image URL) is unchanged are copied from the previous file, so a weekly run only
downloads new / changed images. Downloads are polite: HobbyAtlasDataBot UA, one thread per host, ≥ 1.05 s between
requests to a host, robots.txt obeyed, local ./assets images read from the checkout (no network). Images are only
held in memory, never stored. With --budget-min the run stops fetching after that many minutes and writes what it has
(the next run fills the rest).

File layout (little-endian):
  b'HAIS' u8 version=1, 3 × u8 pad, u32 dim, u32 rows, u32 json_bytes,
  json (utf-8, space-padded to a multiple of 4): {"model", "updated", "ids": [kit_id per row], "src": [url hash per row]},
  f32 scale[rows], i8 vec[rows × dim]      — row vector ≈ vec * scale (L2-normalised before quantising)

usage: build_vectors.py REPO MODEL.tflite OUT.bin [--prev PREV.bin] [--budget-min N]
"""
import argparse
import collections
import hashlib
import io
import json
import os
import struct
import threading
import time
import urllib.error
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone
from urllib.parse import urlparse

import numpy as np
from PIL import Image

UA = 'HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)'
MODEL_ID = 'siglip2-b32-256-wi8'
SIZE = 256
FRANCHISES = ['gundam', 'pokemon', 'fate', 'armored_core', 'beyblade']

ap = argparse.ArgumentParser()
ap.add_argument('repo')
ap.add_argument('model')
ap.add_argument('out')
ap.add_argument('--prev')
ap.add_argument('--budget-min', type=float, default=0)
args = ap.parse_args()
t_start = time.time()


def src_hash(url):
    return hashlib.sha1(url.encode()).hexdigest()[:10]


def is_local(u):
    return not u.startswith('http')


# ── gallery ─────────────────────────────────────────────────────────────────────────────────────
def load(rel):
    with open(os.path.join(args.repo, rel), encoding='utf-8') as f:
        return json.load(f)


boxart = load('data/atlas/gundam-boxart.json').get('boxart', {})
rows = []  # (kit_id, url)
for fr in FRANCHISES:
    for k in load(f'data/split/kits-{fr}.json')['kits']:
        kid = k.get('kit_id')
        gal = [u for u in (k.get('gallery_image_urls') or []) if isinstance(u, str) and u]
        main = (k.get('images') or {}).get('box_art_url') or (gal[0] if gal else None)
        if not kid or not main:
            continue
        alt = None
        b = boxart.get(kid) or {}
        if b.get('url') and b['url'] != main:
            alt = b['url']
        else:
            alt = next((u for u in gal if u != main and is_local(u)), None)
        rows.append((kid, main))
        if alt:
            rows.append((kid, alt))
print('gallery rows', len(rows), 'kits', len({r[0] for r in rows}), flush=True)


# ── previous file ───────────────────────────────────────────────────────────────────────────────
def read_bin(path):
    with open(path, 'rb') as f:
        data = f.read()
    assert data[:4] == b'HAIS' and data[4] == 1, 'not an imgsim v1 file'
    dim, n, jl = struct.unpack_from('<III', data, 8)
    meta = json.loads(data[20:20 + jl])
    off = 20 + jl
    scale = np.frombuffer(data, '<f4', n, off)
    vec = np.frombuffer(data, 'i1', n * dim, off + 4 * n).reshape(n, dim)
    return meta, dim, scale, vec


reuse = {}
if args.prev and os.path.exists(args.prev):
    try:
        meta, dim, scale, vec = read_bin(args.prev)
        if meta.get('model') == MODEL_ID:
            for i, (kid, h) in enumerate(zip(meta['ids'], meta['src'])):
                reuse[(kid, h)] = (scale[i], vec[i])
        print('previous rows reusable', len(reuse), flush=True)
    except Exception as e:  # a broken / old file just means a full run
        print('previous file ignored:', repr(e)[:200], flush=True)

todo = [(kid, u) for kid, u in rows if (kid, src_hash(u)) not in reuse]
print('to embed', len(todo), flush=True)

# ── model ───────────────────────────────────────────────────────────────────────────────────────
try:
    from ai_edge_litert.interpreter import Interpreter
except ImportError:
    from tensorflow.lite.python.interpreter import Interpreter
interp = Interpreter(model_path=args.model, num_threads=os.cpu_count() or 2)
interp.allocate_tensors()
inp, outp = interp.get_input_details()[0], interp.get_output_details()[0]
DIM = int(outp['shape'][-1])
lock = threading.Lock()


def prep(data):
    """Same steps as the app (lib/ml/visual_prep.dart): alpha on white → shorter side 256 → center crop → [0, 1]."""
    im = Image.open(io.BytesIO(data))
    im.load()
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        bg = Image.new('RGB', im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[3])
        im = bg
    im = im.convert('RGB')
    im.thumbnail((320, 320), Image.LANCZOS)  # catalog images vary a lot in size; the eval gallery was ≤ 320 px
    w, h = im.size
    s = SIZE / min(w, h)
    im = im.resize((max(SIZE, round(w * s)), max(SIZE, round(h * s))), Image.BICUBIC)
    l, t = (im.width - SIZE) // 2, (im.height - SIZE) // 2
    im = im.crop((l, t, l + SIZE, t + SIZE))
    return np.asarray(im, np.float32)[None] / 255.0


def embed(data):
    x = prep(data)
    with lock:
        interp.set_tensor(inp['index'], x)
        interp.invoke()
        y = interp.get_tensor(outp['index'])[0].astype(np.float32)
    y /= np.linalg.norm(y) + 1e-12
    s = float(np.abs(y).max()) / 127 or 1.0
    return np.float32(s), np.clip(np.round(y / s), -127, 127).astype(np.int8)


# ── polite fetch ────────────────────────────────────────────────────────────────────────────────
robots = {}


def allowed(u):
    p = urlparse(u)
    host = f'{p.scheme}://{p.netloc}'
    if host not in robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            req = urllib.request.Request(host + '/robots.txt', headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                rp.parse(r.read().decode('utf-8', 'replace').splitlines())
        except urllib.error.HTTPError as e:
            rp.parse([] if e.code in (404, 410) else ['User-agent: *', 'Disallow: /'])
        except Exception:
            rp.parse([])
        robots[host] = rp
    return robots[host].can_fetch(UA, u)


def local_bytes(u):
    path = u[2:] if u.startswith('./') else u
    while path.startswith('../'):
        path = path[3:]
    path = path if path.startswith('app/') else 'app/' + path
    with open(os.path.join(args.repo, path), 'rb') as f:
        return f.read()


done = {}
fails = collections.Counter()
stopped = threading.Event()
jobs = collections.defaultdict(list)
for kid, u in todo:
    jobs['LOCAL' if is_local(u) else urlparse(u).netloc].append((kid, u))


def over_budget():
    return args.budget_min and time.time() - t_start > args.budget_min * 60


def worker(host, lst):
    last = 0.0
    for kid, u in lst:
        if over_budget():
            stopped.set()
            return
        try:
            if host == 'LOCAL':
                data = local_bytes(u)
            else:
                if not allowed(u):
                    fails['robots'] += 1
                    continue
                wait = last + 1.05 - time.time()
                if wait > 0:
                    time.sleep(wait)
                last = time.time()
                req = urllib.request.Request(u, headers={'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=30) as r:
                    data = r.read()
            done[(kid, src_hash(u))] = embed(data)
        except Exception as e:
            fails[type(e).__name__] += 1


threads = [threading.Thread(target=worker, args=(h, l), daemon=True) for h, l in jobs.items()]
print({h: len(l) for h, l in jobs.items()}, flush=True)
for t in threads:
    t.start()
while any(t.is_alive() for t in threads):
    time.sleep(30)
    print(time.strftime('%H:%M:%S'), 'embedded', len(done), 'fails', dict(fails), flush=True)

# ── write ───────────────────────────────────────────────────────────────────────────────────────
ids, src, scales, vecs = [], [], [], []
for kid, u in rows:
    key = (kid, src_hash(u))
    got = done.get(key) or reuse.get(key)
    if got is None:
        continue
    ids.append(kid)
    src.append(key[1])
    scales.append(got[0])
    vecs.append(got[1])
meta = dict(model=MODEL_ID, updated=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), ids=ids, src=src)
js = json.dumps(meta, ensure_ascii=False, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4)
with open(args.out + '.tmp', 'wb') as f:
    f.write(b'HAIS' + bytes([1, 0, 0, 0]) + struct.pack('<III', DIM, len(ids), len(js)))
    f.write(js)
    f.write(np.asarray(scales, '<f4').tobytes())
    f.write(np.stack(vecs).astype('i1').tobytes() if vecs else b'')
os.replace(args.out + '.tmp', args.out)
summary = dict(
    rows=len(ids),
    kits=len(set(ids)),
    gallery_rows=len(rows),
    new=len(done),
    reused=len(ids) - sum(1 for k in zip(ids, src) if k in done),
    fails=dict(fails),
    stopped_by_budget=stopped.is_set(),
    bytes=os.path.getsize(args.out),
    minutes=round((time.time() - t_start) / 60, 1),
)
print(json.dumps(summary), flush=True)
with open(args.out + '.summary.json', 'w') as f:
    json.dump(summary, f)
