"""Hobby Atlas "생김새로 찾기" — shared pieces of the imgsim scripts that need neither numpy nor a model: the model
registry, which catalog images are indexed, the vectors file (HAIS v1) and the two manifests the apps read.

Tested by scripts/test_imgsim.mjs (runs scripts/imgsim/test_imgsim_lib.py).
"""
import hashlib
import json
import struct
from urllib.parse import quote

UA = 'HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)'
RELEASE_URL = 'https://github.com/mdefitko777/Gunpula/releases/download/imgsim/'
FRANCHISES = ['gundam', 'pokemon', 'fate', 'armored_core', 'beyblade', 'madoka']

# FGO リアル脱出ゲーム tickets (264 Fate records, 2026-11-14) share a few near-identical event banners: one banner
# matched 105 kits at cos > 0.97 and filled whole result grids. Nobody photographs a ticket to find it again.
SKIP_GOODS_KINDS = {'ticket'}

# File names of the B/32 entries are the ones installed apps already know (imgsim.json schema 1) — never rename them.
MODELS = {
    'siglip2-b32-256-wi8': dict(
        arch='ViT-B-32-SigLIP2-256', pretrained='webli', size=256,
        file='siglip2-b32-256-wi8.tflite', meta='model.json', vectors='imgsim-vectors.bin',
    ),
    # 2026-11-14 eval (same gallery rows, open_clip float): Pokémon leave-one-out subj@1 51 → 62, real Pokémon photos
    # @1 57 → 74, real Beyblade exact @12 0 → 100; Fate real photos @12 68 → 59 (n = 22). Same 768-d output, ~94 MB
    # int8 weights like B/32, about 3× slower per photo.
    'siglip2-b16-256-wi8': dict(
        arch='ViT-B-16-SigLIP2-256', pretrained='webli', size=256,
        file='siglip2-b16-256-wi8.tflite', meta='siglip2-b16-256-wi8.model.json',
        vectors='imgsim-vectors-siglip2-b16-256-wi8.bin',
    ),
}
LEGACY_MODEL = 'siglip2-b32-256-wi8'
PREFERRED_MODEL = 'siglip2-b16-256-wi8'
# The preferred model becomes the default only when its vectors hold (nearly) every kit the B/32 file holds; its first
# fill re-reads every gallery image and takes one or two daily runs. Compared with B/32, not with the gallery: some
# images can never be read (pokemoncenter-online answers 403, 2026-11-14).
MIN_DEFAULT_COVERAGE = 0.98
# Owner hold (2026-11-14): B/16 is built and listed so it can be measured on the phones, but it does not become the
# default until its on-device speed is known (estimated 0.7–1.5 s per photo vs 0.2–0.4 s) — flip this to promote it.
PROMOTE_PREFERRED = False


def src_hash(url):
    return hashlib.sha1(url.encode()).hexdigest()[:10]


def is_local(url):
    return not url.startswith('http')


def fetch_url(url):
    """The URL as it goes on the wire. The KR Pokémon store has file names with spaces and Hangul / kana
    (28 covers on 2026-11-14), which urllib refuses (InvalidURL); existing %-escapes are kept."""
    return quote(url, safe=":/?#[]@!$&'()*+,;=%~")


def gallery_rows(split, boxart):
    """split: {franchise: [kit, ...]} (data/split/kits-*.json), boxart: data/atlas/gundam-boxart.json `boxart`.
    → [(kit_id, url, franchise index)]: the cover (images.box_art_url, else the first gallery image) and, when
    different, the atlas box art or the 2nd local gallery image. A kit's rows are adjacent."""
    rows = []
    for fi, fr in enumerate(FRANCHISES):
        for k in split.get(fr) or []:
            kid = k.get('kit_id')
            if not kid or k.get('goods_kind') in SKIP_GOODS_KINDS:
                continue
            gal = [u for u in (k.get('gallery_image_urls') or []) if isinstance(u, str) and u]
            main = (k.get('images') or {}).get('box_art_url') or (gal[0] if gal else None)
            if not main:
                continue
            b = boxart.get(kid) or {}
            if b.get('url') and b['url'] != main:
                alt = b['url']
            else:
                alt = next((u for u in gal if u != main and is_local(u)), None)
            rows.append((kid, main, fi))
            if alt:
                rows.append((kid, alt, fi))
    return rows


def resolve_aliases(aliases):
    """data/split/kit-aliases.json `aliases` (old id → new id, possibly chained) → old id → the id that exists now."""
    def last(k):
        for _ in range(8):  # a → b → c, never loops forever
            if k not in aliases:
                break
            k = aliases[k]
        return k
    return {k: last(k) for k in aliases}


def assemble(rows, vector_of, prev_rows):
    """rows: gallery_rows(); vector_of(url) → (scale, int8 bytes) or None; prev_rows: {kit_id now: [(src hash, scale,
    int8 bytes), ...]} from the previous file. → (ids, src, fr, scales, vecs, kept): a kit's rows stay adjacent.

    A kit none of whose current images has a vector yet keeps its previous rows (`kept` counts those kits): the 2026-11-14
    dry run dropped 71 Pokémon kits whose cover had moved to the KR store when the budget ran out, and a host that
    refuses (403) would have dropped them for good. Their src stays the old image's hash, so the new image is still
    fetched on a later run."""
    ids, src, fr, scales, vecs = [], [], [], [], []
    kept = 0
    i = 0
    while i < len(rows):
        kid, fi = rows[i][0], rows[i][2]
        j = i
        while j < len(rows) and rows[j][0] == kid:
            j += 1
        got = [(src_hash(u), v) for _, u, _ in rows[i:j] for v in (vector_of(u),) if v is not None]
        if not got and prev_rows.get(kid):
            got = [(h, (s, v)) for h, s, v in prev_rows[kid]]
            kept += 1
        for h, (s, v) in got:
            ids.append(kid)
            src.append(h)
            fr.append(fi)
            scales.append(s)
            vecs.append(v)
        i = j
    return ids, src, fr, scales, vecs, kept


# ── vectors file ────────────────────────────────────────────────────────────────────────────────
# b'HAIS' u8 version=1, 3 × u8 pad, u32 dim, u32 rows, u32 json_bytes, json (utf-8, space-padded to a multiple of 4),
# f32 scale[rows], i8 vec[rows × dim]. Installed apps check the version byte, so new metadata goes into the JSON.

def pack_vectors(model, updated, dim, ids, src, fr, scales, vecs):
    """vecs: one `dim`-byte int8 row (bytes) per row; fr: franchise index per row."""
    assert len(ids) == len(src) == len(fr) == len(scales) == len(vecs)
    meta = dict(model=model, updated=updated, franchises=FRANCHISES, ids=ids, src=src, fr=fr)
    js = json.dumps(meta, ensure_ascii=False, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    head = b'HAIS' + bytes([1, 0, 0, 0]) + struct.pack('<III', dim, len(ids), len(js))
    body = struct.pack(f'<{len(scales)}f', *scales)
    assert all(len(v) == dim for v in vecs)
    return head + js + body + b''.join(vecs)


def unpack_vectors(data):
    """→ (meta, dim, scales [float], vecs [bytes]). Raises on anything that is not a HAIS v1 file."""
    if data[:4] != b'HAIS' or data[4] != 1:
        raise ValueError('not an imgsim v1 file')
    dim, n, jl = struct.unpack_from('<III', data, 8)
    meta = json.loads(data[20:20 + jl])
    off = 20 + jl
    scales = list(struct.unpack_from(f'<{n}f', data, off))
    off += 4 * n
    if len(data) < off + n * dim:
        raise ValueError('imgsim file is cut short')
    vecs = [data[off + i * dim:off + (i + 1) * dim] for i in range(n)]
    return meta, dim, scales, vecs


def pack_stable(prev, model, now, dim, ids, src, fr, scales, vecs):
    """Pack with the previous file's `updated` when nothing else changed, so an unchanged index keeps its bytes and
    sha256: the app re-downloads the 10.7 MB file whenever the sha differs, and the old builder stamped every run."""
    if prev:
        try:
            pm = unpack_vectors(prev)[0]
            same = pack_vectors(model, pm.get('updated', ''), dim, ids, src, fr, scales, vecs)
            if same == prev:
                return same, False
        except (ValueError, KeyError, struct.error):
            pass
    return pack_vectors(model, now, dim, ids, src, fr, scales, vecs), True


# ── manifests ───────────────────────────────────────────────────────────────────────────────────

def vectors_entry(model_id, info):
    """info: {bytes, sha256, rows, kits, updated, coverage, kits_by_franchise} of one built vectors file."""
    name = MODELS[model_id]['vectors']
    return dict(
        file=name, url=RELEASE_URL + name, bytes=info['bytes'], sha256=info['sha256'], rows=info['rows'],
        kits=info['kits'], updated=info['updated'], model=model_id, coverage=info['coverage'],
        kits_by_franchise=info['kits_by_franchise'],
    )


def model_entry(model_id, meta, info):
    """meta: the model's JSON from convert_model.py; info: {bytes, sha256} of the .tflite in the release."""
    name = MODELS[model_id]['file']
    out = {k: v for k, v in meta.items() if k not in ('id', 'file', 'url', 'bytes', 'sha256')}
    return dict(id=model_id, file=name, url=RELEASE_URL + name, bytes=info['bytes'], sha256=info['sha256'], **out)


def build_manifests(models, vectors, promote=None):
    """models: {id: (model meta, {bytes, sha256})}, vectors: {id: vectors info} → (imgsim.json, imgsim-v2.json).

    imgsim.json stays schema 1 with exactly the fields installed apps read (B/32 only); imgsim-v2.json lists every
    model that has both files. Neither has a run timestamp, so they only change when a listed file does."""
    v1 = None
    if LEGACY_MODEL in models and LEGACY_MODEL in vectors:
        meta, info = models[LEGACY_MODEL]
        model = {k: v for k, v in model_entry(LEGACY_MODEL, meta, info).items() if k != 'id'}
        vec = vectors_entry(LEGACY_MODEL, vectors[LEGACY_MODEL])
        vec = {k: vec[k] for k in ('file', 'url', 'bytes', 'sha256', 'rows', 'kits', 'updated', 'model')}
        v1 = dict(schema=1, model=model, vectors=vec)
    listed = []
    for mid in MODELS:
        if mid in models and mid in vectors:
            meta, info = models[mid]
            listed.append(dict(model_entry(mid, meta, info), vectors=vectors_entry(mid, vectors[mid])))
    default = LEGACY_MODEL
    if promote is None:
        promote = PROMOTE_PREFERRED
    if promote and PREFERRED_MODEL in vectors and PREFERRED_MODEL in models:
        want = vectors[LEGACY_MODEL]['kits'] if v1 else 0
        if vectors[PREFERRED_MODEL]['kits'] >= MIN_DEFAULT_COVERAGE * want:
            default = PREFERRED_MODEL
    if not any(m['id'] == default for m in listed):
        default = listed[0]['id'] if listed else None
    v2 = dict(schema=2, default=default, franchises=FRANCHISES, models=listed) if listed else None
    return v1, v2


def manifest_bytes(m):
    return (json.dumps(m, ensure_ascii=False, indent=1) + '\n').encode()
