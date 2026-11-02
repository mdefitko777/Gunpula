"""Hobby Atlas "생김새로 찾기" — SigLIP2 ViT-B/32-256 (Apache-2.0, webli) image tower → LiteRT (.tflite).

The exported model takes the already-cropped photo, NHWC float32 in [0, 1] (1, 256, 256, 3), and returns the
L2-normalised 768-d embedding (1, 768). Normalisation ((x - 0.5) / 0.5) is inside the model, so the app and
build_vectors.py only resize, center-crop and divide by 255.

Weights are stored int8, activations stay float32 (ai-edge-quantizer `weight_only_wi8_afp32`). The image-similarity
eval showed dynamic-range / full int8 breaks this model (R@1 44 → 13); weight-only keeps cos ≥ 0.99 with the float model.

usage: convert_model.py OUT_DIR      → OUT_DIR/siglip2-b32-256-wi8.tflite + OUT_DIR/model.json
"""
import json
import os
import sys

import numpy as np
import torch

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
ARCH, TAG, SIZE = 'ViT-B-32-SigLIP2-256', 'webli', 256
NAME = 'siglip2-b32-256-wi8.tflite'

import open_clip  # noqa: E402

pcfg = open_clip.get_pretrained_cfg(ARCH, TAG)
# open_clip falls back to OpenAI-CLIP mean/std when the tag has none — SigLIP must be 0.5 / 0.5
assert tuple(pcfg['mean']) == (0.5, 0.5, 0.5) and tuple(pcfg['std']) == (0.5, 0.5, 0.5), pcfg
visual = open_clip.create_model(ARCH, pretrained=TAG).visual.eval()


class Tower(torch.nn.Module):
    def __init__(self, f):
        super().__init__()
        self.f = f

    def forward(self, x):  # x: (1, H, W, 3) in [0, 1]
        x = (x.permute(0, 3, 1, 2) - 0.5) / 0.5
        return torch.nn.functional.normalize(self.f(x).float(), dim=-1)


tower = Tower(visual).eval()
sample = (torch.rand(1, SIZE, SIZE, 3),)

try:
    import litert_torch as edge
except ImportError:
    import ai_edge_torch as edge

f32 = os.path.join(OUT, 'f32.tflite')
edge.convert(tower, sample).export(f32)

from ai_edge_quantizer import quantizer, recipe  # noqa: E402

q = quantizer.Quantizer(f32)
q.load_quantization_recipe(recipe.weight_only_wi8_afp32())
out = os.path.join(OUT, NAME)
q.quantize().export_model(out, overwrite=True)

# check: the quantised LiteRT model against PyTorch on random + structured inputs
try:
    from ai_edge_litert.interpreter import Interpreter
except ImportError:
    from tensorflow.lite.python.interpreter import Interpreter


def run(path, xs):
    it = Interpreter(model_path=path, num_threads=2)
    it.allocate_tensors()
    i, o = it.get_input_details()[0], it.get_output_details()[0]
    ys = []
    for x in xs:
        it.set_tensor(i['index'], x[None])
        it.invoke()
        ys.append(it.get_tensor(o['index'])[0].copy())
    return np.stack(ys), i, o


rng = np.random.RandomState(0)
xs = [rng.rand(SIZE, SIZE, 3).astype(np.float32) for _ in range(4)]
yy, xx = np.mgrid[0:SIZE, 0:SIZE] / SIZE
xs += [np.stack([yy, xx, 1 - yy], -1).astype(np.float32), np.ones((SIZE, SIZE, 3), np.float32)]
with torch.no_grad():
    ref = tower(torch.from_numpy(np.stack(xs))).numpy()
cos = {}
for tag, path in (('f32', f32), ('wi8', out)):
    y, i, o = run(path, xs)
    cos[tag] = round(float(np.min(np.sum(y * ref, 1) / np.linalg.norm(y, axis=1))), 4)
print('min cos vs torch', cos, 'input', i['shape'], i['dtype'], 'output', o['shape'])
assert cos['f32'] > 0.999 and cos['wi8'] > 0.98, cos
os.remove(f32)

meta = dict(
    file=NAME,
    bytes=os.path.getsize(out),
    arch=ARCH,
    pretrained=TAG,
    licence='Apache-2.0 (google/siglip2 via open_clip)',
    input=dict(shape=[1, SIZE, SIZE, 3], layout='NHWC', range='0..1', prep='flatten alpha on white → resize shorter side to 256 (bicubic) → center crop 256'),
    output=dict(dim=int(ref.shape[1]), normalised=True),
    min_cos_vs_torch=cos,
)
json.dump(meta, open(os.path.join(OUT, 'model.json'), 'w'), indent=1)
print(json.dumps(meta, indent=1))
