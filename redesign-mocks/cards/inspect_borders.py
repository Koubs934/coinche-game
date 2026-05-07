"""Inspect 4 representative cards to find required TRIM offset.

For each card, scan inward from each edge (top/bottom/left/right) at
offsets 0, 5, 10, 15, 20, 25, 30 px and report the pixel color found.
The offset at which all 4 sides reach cream tells us the safe TRIM.
"""

from PIL import Image
from pathlib import Path

SRC = Path(__file__).parent / "individual"
CREAM = (244, 232, 208)
TOL = 20

CARDS = ["7-coeur.png", "10-pique.png", "D-trefle.png", "R-carreau.png"]
OFFSETS = [0, 5, 10, 15, 20, 25, 30]


def is_cream(px):
    return all(abs(px[i] - CREAM[i]) <= TOL for i in range(3))


def sample_strip(img, side, offset):
    """Sample 5 evenly-spaced pixels along a side at the given offset
    from that edge. Returns (n_cream, sample_colors)."""
    w, h = img.size
    pixels = img.load()
    samples = []
    if side == "top":
        y = offset
        xs = [w * i // 6 for i in range(1, 6)]
        samples = [pixels[x, y] for x in xs]
    elif side == "bottom":
        y = h - 1 - offset
        xs = [w * i // 6 for i in range(1, 6)]
        samples = [pixels[x, y] for x in xs]
    elif side == "left":
        x = offset
        ys = [h * i // 6 for i in range(1, 6)]
        samples = [pixels[x, y] for y in ys]
    elif side == "right":
        x = w - 1 - offset
        ys = [h * i // 6 for i in range(1, 6)]
        samples = [pixels[x, y] for y in ys]
    n_cream = sum(1 for s in samples if is_cream(s))
    return n_cream, samples


for card_name in CARDS:
    path = SRC / card_name
    img = Image.open(path).convert("RGB")
    w, h = img.size
    print(f"\n{'='*60}")
    print(f"{card_name}  ({w}x{h})")
    print(f"{'='*60}")
    for side in ("top", "bottom", "left", "right"):
        print(f"  {side}:")
        for off in OFFSETS:
            n_cream, samples = sample_strip(img, side, off)
            status = "OK all cream" if n_cream == 5 else f"{n_cream}/5 cream"
            sample_str = " ".join(f"{s}" for s in samples[:3])
            print(f"    offset={off:3d}  {status:18s}  e.g. {sample_str}")

print("\n→ The TRIM value should be the smallest offset at which ALL")
print("  4 sides on ALL 4 cards report '5/5 cream'.")
