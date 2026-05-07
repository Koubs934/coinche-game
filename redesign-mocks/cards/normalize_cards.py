"""Normalize all 32 cards to a uniform 400x600 cream canvas.

Source cards have varying dimensions (171-196 x 256-294) and inconsistent
AI-drawn rims. We can't use a fixed TRIM as the brief assumed because the
input isn't 400x600 to begin with.

Strategy per card:
  1. Find content bounding box (non-cream pixels) — this is the card
     INCLUDING its white rim, with the slicer's outer cream pad removed.
  2. Crop to that bbox.
  3. Trim a fraction of each side to remove the white rim.
  4. Resize the inner content to fit a uniform inner area (360x540 = 90%
     of target), preserving aspect ratio.
  5. Paste centered on a fresh 400x600 cream canvas.

Output: 32 PNGs at exactly 400x600 with a uniform cream margin and
clean content area. CSS adds the visible border + radius.
"""

from PIL import Image
from pathlib import Path

SRC = Path(__file__).parent / "individual"
DST = Path(__file__).parent / "processed"
DST.mkdir(parents=True, exist_ok=True)

CREAM = (244, 232, 208)
TOL = 25
TARGET_W, TARGET_H = 400, 600
INNER_W, INNER_H = 360, 540  # 90% — leaves a uniform 20px cream margin
RIM_FRAC = 0.06  # trim 6% off each side after bbox crop to remove the rim


def is_cream(px):
    return all(abs(px[i] - CREAM[i]) <= TOL for i in range(3))


def find_content_bbox(img):
    """Find the tight bbox of non-cream pixels — i.e. the card itself
    (including its rim), with the slicer's outer cream pad excluded."""
    w, h = img.size
    pixels = img.load()
    top, bottom, left, right = h, -1, w, -1
    for y in range(h):
        if any(not is_cream(pixels[x, y]) for x in range(w)):
            top = y
            break
    for y in range(h - 1, -1, -1):
        if any(not is_cream(pixels[x, y]) for x in range(w)):
            bottom = y
            break
    for x in range(w):
        if any(not is_cream(pixels[x, y]) for y in range(h)):
            left = x
            break
    for x in range(w - 1, -1, -1):
        if any(not is_cream(pixels[x, y]) for y in range(h)):
            right = x
            break
    return (left, top, right + 1, bottom + 1)


def main():
    files = sorted(SRC.glob("*.png"))
    summary = []
    for f in files:
        img = Image.open(f).convert("RGB")
        orig_size = img.size

        bbox = find_content_bbox(img)
        cropped = img.crop(bbox)
        cw, ch = cropped.size

        # Trim rim by RIM_FRAC of cropped dims
        tx = int(cw * RIM_FRAC)
        ty = int(ch * RIM_FRAC)
        inner = cropped.crop((tx, ty, cw - tx, ch - ty))

        # Scale to fill INNER_W x INNER_H, preserving aspect.
        # resize() handles both up- and downscaling (thumbnail won't upscale).
        iw, ih = inner.size
        scale = min(INNER_W / iw, INNER_H / ih)
        new_w = max(1, int(iw * scale))
        new_h = max(1, int(ih * scale))
        inner = inner.resize((new_w, new_h), Image.LANCZOS)

        # Paste centered on fresh cream canvas
        canvas = Image.new("RGB", (TARGET_W, TARGET_H), CREAM)
        px = (TARGET_W - inner.width) // 2
        py = (TARGET_H - inner.height) // 2
        canvas.paste(inner, (px, py))

        out_path = DST / f.name
        canvas.save(out_path, "PNG", optimize=True)
        summary.append((f.name, orig_size, bbox, inner.size))

    # Print a concise summary
    print(f"Processed {len(summary)} cards -> {DST}")
    print(f"  RIM_FRAC = {RIM_FRAC} (6% per-side rim trim after content-bbox crop)")
    print(f"  Target = {TARGET_W}x{TARGET_H}, inner = {INNER_W}x{INNER_H} (uniform 20px cream margin)")
    print(f"\n  Per-card details (orig -> content_bbox -> final inner):")
    for name, orig, bb, inner_sz in summary[:6]:
        bb_w = bb[2] - bb[0]
        bb_h = bb[3] - bb[1]
        print(f"    {name:18s}  {orig[0]}x{orig[1]}  ->  {bb_w}x{bb_h}  ->  {inner_sz[0]}x{inner_sz[1]}")
    if len(summary) > 6:
        print(f"    ... ({len(summary) - 6} more)")


if __name__ == "__main__":
    main()
