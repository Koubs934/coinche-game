"""Slice deck.png into 32 individual cards.

Strategy: detect each card's bounding box by row/column projection of
non-white pixels, then crop with a small uniform pad. Falls back to
naive grid division if projection detection fails for a cell.
"""

from PIL import Image, ImageChops
from pathlib import Path

DECK = Path(__file__).parent / "deck.png"
OUT = Path(__file__).parent / "individual"
OUT.mkdir(parents=True, exist_ok=True)

ROWS = ["coeur", "carreau", "trefle", "pique"]
COLS = ["7", "8", "9", "10", "V", "D", "R", "A"]

img = Image.open(DECK).convert("RGB")
W, H = img.size
print(f"Deck: {W}x{H}")

# Use a luminance threshold to detect "card content" pixels.
# Cards have a cream background (~244, 232, 208) — quite distinct from
# the white/very light gray separators between them. We classify a
# pixel as "card" when at least one channel is below ~245 (i.e. it
# isn't pure white separator).
gray = img.convert("L")
bw = gray.point(lambda p: 0 if p > 248 else 255)  # 0 = white separator, 255 = card

# Project to find row & column bands.
def runs(arr, min_len):
    """Return list of (start, end) where arr is non-zero (above min)."""
    out = []
    in_run = False
    s = 0
    for i, v in enumerate(arr):
        if v > 0 and not in_run:
            in_run = True
            s = i
        elif v == 0 and in_run:
            in_run = False
            if i - s >= min_len:
                out.append((s, i))
    if in_run and len(arr) - s >= min_len:
        out.append((s, len(arr)))
    return out

# Sum each row of bw — high value = lots of card pixels in that row.
px = bw.load()
row_sum = [sum(px[x, y] for x in range(W)) // 255 for y in range(H)]
col_sum = [sum(px[x, y] for y in range(H)) // 255 for x in range(W)]

# Find horizontal bands (rows of cards) and vertical bands (cols).
# Use a fraction of width/height as a content threshold.
ROW_THRESH = W * 0.25
COL_THRESH = H * 0.25

row_mask = [1 if v > ROW_THRESH else 0 for v in row_sum]
col_mask = [1 if v > COL_THRESH else 0 for v in col_sum]

row_bands = runs(row_mask, min_len=H // 12)
col_bands = runs(col_mask, min_len=W // 24)

print(f"Detected {len(row_bands)} row bands, {len(col_bands)} col bands")

# Validate. If detection failed, fall back to even grid division.
if len(row_bands) != 4 or len(col_bands) != 8:
    print("Projection failed — using naive grid division")
    cell_w = W // 8
    cell_h = H // 4
    row_bands = [(r * cell_h, (r + 1) * cell_h) for r in range(4)]
    col_bands = [(c * cell_w, (c + 1) * cell_w) for c in range(8)]

PAD = 4  # small uniform pad so we don't shave the artwork

for r_idx, (y0, y1) in enumerate(row_bands):
    for c_idx, (x0, x1) in enumerate(col_bands):
        bx0 = max(0, x0 - PAD)
        by0 = max(0, y0 - PAD)
        bx1 = min(W, x1 + PAD)
        by1 = min(H, y1 + PAD)
        crop = img.crop((bx0, by0, bx1, by1))

        # Force 2:3 aspect ratio by adjusting (don't squash; pad with cream).
        cw, ch = crop.size
        target_ratio = 2 / 3
        cur_ratio = cw / ch
        if cur_ratio > target_ratio:
            # too wide → pad height
            new_h = int(cw / target_ratio)
            pad_top = (new_h - ch) // 2
            canvas = Image.new("RGB", (cw, new_h), (244, 232, 208))
            canvas.paste(crop, (0, pad_top))
            crop = canvas
        elif cur_ratio < target_ratio:
            # too tall → pad width
            new_w = int(ch * target_ratio)
            pad_left = (new_w - cw) // 2
            canvas = Image.new("RGB", (new_w, ch), (244, 232, 208))
            canvas.paste(crop, (pad_left, 0))
            crop = canvas

        rank = COLS[c_idx]
        suit = ROWS[r_idx]
        out_path = OUT / f"{rank}-{suit}.png"
        crop.save(out_path, "PNG", optimize=True)

print(f"Wrote {len(row_bands) * len(col_bands)} cards to {OUT}")
