"""Hobby Atlas "생김새로 찾기" — write the manifests the apps read and list what the workflow must upload.

  imgsim.json     schema 1, B/32 only — what installed apps (≤ 1.1.13) read; same fields as before
  imgsim-v2.json  schema 2, every model with its vectors + the default (imgsim_lib.build_manifests)

Only files whose bytes differ from the release are listed in OUT_DIR/upload.txt, vectors before manifests, so a
manifest never points at a file that is not uploaded yet and a day without new images uploads nothing.

usage: publish_manifest.py DIR OUT_DIR
  DIR: the release assets (models, model metas, previous vectors and manifests); OUT_DIR: build_vectors.py output
"""
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from imgsim_lib import MODELS, build_manifests, manifest_bytes  # noqa: E402

DIR, OUT = sys.argv[1], sys.argv[2]


def read(path):
    with open(path, 'rb') as f:
        return f.read()


def file_info(path):
    data = read(path)
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


models, vectors, upload = {}, {}, []
for mid, spec in MODELS.items():
    mp, meta_path, vp = (os.path.join(DIR, spec['file']), os.path.join(DIR, spec['meta']),
                         os.path.join(OUT, spec['vectors']))
    if not (os.path.exists(mp) and os.path.exists(meta_path) and os.path.exists(vp)):
        continue
    with open(meta_path, encoding='utf-8') as f:
        models[mid] = (json.load(f), file_info(mp))
    with open(vp + '.summary.json', encoding='utf-8') as f:
        s = json.load(f)
    vectors[mid] = dict(file_info(vp), **{k: s[k] for k in ('rows', 'kits', 'updated', 'coverage', 'kits_by_franchise')})
    prev = os.path.join(DIR, spec['vectors'])
    if not os.path.exists(prev) or file_info(prev)['sha256'] != vectors[mid]['sha256']:
        upload.append(vp)

v1, v2 = build_manifests(models, vectors)
for name, m in (('imgsim-v2.json', v2), ('imgsim.json', v1)):
    if m is None:
        print(name, 'not written: no model with vectors', flush=True)
        continue
    data = manifest_bytes(m)
    path = os.path.join(OUT, name)
    with open(path, 'wb') as f:
        f.write(data)
    prev = os.path.join(DIR, name)
    if not os.path.exists(prev) or read(prev) != data:
        upload.append(path)
with open(os.path.join(OUT, 'upload.txt'), 'w', encoding='utf-8') as f:
    f.write(''.join(p + '\n' for p in upload))
print('default', v2 and v2['default'], 'upload', [os.path.basename(p) for p in upload], flush=True)
