"""Generate a seamless tileable 256x256 felt texture (subtle dark green wool)."""
from PIL import Image, ImageFilter, ImageDraw
import random
import os

random.seed(1921)

W = H = 256
base = (31, 61, 46)  # --vert-tapis

# Build noise on a 3x3 grid then crop center for seamless tiling
big = Image.new('RGB', (W * 3, H * 3), base)
px = big.load()
for y in range(H * 3):
    for x in range(W * 3):
        r, g, b = px[x, y]
        n = random.randint(-7, 7)
        px[x, y] = (
            max(0, min(255, r + n)),
            max(0, min(255, g + n)),
            max(0, min(255, b + n)),
        )
big = big.filter(ImageFilter.GaussianBlur(radius=0.5))

# Add diagonal fiber strokes
draw = ImageDraw.Draw(big)
for _ in range(6500):
    x = random.randint(0, W * 3 - 1)
    y = random.randint(0, H * 3 - 1)
    length = random.randint(2, 6)
    dx, dy = random.choice([(1, 0), (0, 1), (1, 1), (1, -1)])
    shade = random.randint(-10, 10)
    color = (
        max(0, min(255, base[0] + shade)),
        max(0, min(255, base[1] + shade)),
        max(0, min(255, base[2] + shade)),
    )
    draw.line([(x, y), (x + dx * length, y + dy * length)], fill=color, width=1)

big = big.filter(ImageFilter.GaussianBlur(radius=0.4))

# Crop center to avoid edge artifacts and ensure seamless wrap
img = big.crop((W, H, W * 2, H * 2))

# Make seamless: blend opposite edges
def make_seamless(img, blend=24):
    w, h = img.size
    px = img.load()
    # horizontal blend: blend right edge with left edge
    for x in range(blend):
        a = blend - x
        for y in range(h):
            l = px[x, y]
            r = px[w - blend + x, y]
            t = a / blend
            blended_l = tuple(int(l[i] * (1 - t * 0.5) + r[i] * t * 0.5) for i in range(3))
            blended_r = tuple(int(r[i] * (1 - t * 0.5) + l[i] * t * 0.5) for i in range(3))
            px[x, y] = blended_l
            px[w - blend + x, y] = blended_r
    # vertical blend
    for y in range(blend):
        a = blend - y
        for x in range(w):
            t_pix = px[x, y]
            b_pix = px[x, h - blend + y]
            t = a / blend
            blended_t = tuple(int(t_pix[i] * (1 - t * 0.5) + b_pix[i] * t * 0.5) for i in range(3))
            blended_b = tuple(int(b_pix[i] * (1 - t * 0.5) + t_pix[i] * t * 0.5) for i in range(3))
            px[x, y] = blended_t
            px[x, h - blend + y] = blended_b
    return img

img = make_seamless(img)

out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'textures', 'felt.png')
img.save(out, optimize=True)
print(f'wrote {out} ({img.size})')

# Also verify by tiling 2x2
preview = Image.new('RGB', (W * 2, H * 2))
for tx in range(2):
    for ty in range(2):
        preview.paste(img, (tx * W, ty * H))
preview_out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'textures', 'felt_tile_preview.png')
preview.save(preview_out, optimize=True)
print(f'tile preview: {preview_out}')
