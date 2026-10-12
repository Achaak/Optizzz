# Bleed opaque colours into transparent pixels so the upscaler doesn't pull the GIF key colour into edges.
import sys, pathlib, numpy as np
from PIL import Image
src, dst = map(pathlib.Path, sys.argv[1:3]); dst.mkdir(exist_ok=True)
for p in sorted(src.iterdir()):
    if p.suffix not in ('.png', '.gif'): continue
    im = np.array(Image.open(p).convert('RGBA')).astype(float)
    rgb, a = im[..., :3], im[..., 3] > 0
    known = a.copy()
    for _ in range(64):
        if known.all(): break
        acc = np.zeros_like(rgb); n = np.zeros(known.shape)
        for dy, dx in ((-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,1),(-1,1),(1,-1)):
            k = np.roll(known, (dy, dx), (0, 1)); c = np.roll(rgb, (dy, dx), (0, 1))
            acc += c * k[..., None]; n += k
        grow = ~known & (n > 0)
        rgb[grow] = acc[grow] / n[grow][:, None]; known |= grow
    im[..., :3] = rgb
    Image.fromarray(im.astype(np.uint8)).save(dst / (p.stem + '.png'))
