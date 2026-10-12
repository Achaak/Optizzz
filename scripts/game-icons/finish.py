# Smooth 1-bit GIF alpha, scale ×4 output down to ×3 (sprite ×2), save as WebP.
import sys, pathlib
from PIL import Image, ImageFilter
flat, up, dst = map(pathlib.Path, sys.argv[1:4]); dst.mkdir(exist_ok=True)
for o in sorted(flat.iterdir()):
    im = Image.open(up / (o.stem + '.png')).convert('RGBA')
    w, h = Image.open(o).size
    if o.suffix == '.gif':
        r, g, b, a = im.split()
        a = a.filter(ImageFilter.GaussianBlur(1.6)).point(lambda v: max(0, min(255, (v - 128) * 2 + 128)))
        im = Image.merge('RGBA', (r, g, b, a))
    f = 2 if 'sprite' in o.stem else 3
    im = im.resize((w * f, h * f), Image.LANCZOS)
    im.save(dst / (o.stem + '.webp'), 'WEBP', quality=90, alpha_quality=100, method=6)
