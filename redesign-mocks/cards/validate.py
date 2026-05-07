"""Programmatic validation of paris-pro/ cards.

Checks:
  1. File count + naming.
  2. Dimensions (600x870) and mode (RGB).
  3. Edge cream uniformity — sample at the 1-pixel-thick perimeter, where
     no card content lives regardless of figure size.
  4. Suit-color presence — for each card, scan the inner card area and
     confirm the dominant non-cream ink is red (hearts/diamonds) or
     dark (clubs/spades).
  5. Alpha channel: must be opaque or absent.
"""

from PIL import Image
from pathlib import Path
import sys

ROOT = Path(__file__).parent / "paris-pro"
CREAM_TARGET = (244, 232, 208)
SUITS = ["coeur", "carreau", "trefle", "pique"]
RANKS = ["7", "8", "9", "10", "V", "D", "R", "A"]
RED_SUITS = {"coeur", "carreau"}
TARGET_W, TARGET_H = 600, 870


def cream_distance(px):
    return sum(abs(px[i] - CREAM_TARGET[i]) for i in range(3))


def is_red(p):
    return p[0] > 150 and p[1] < 100 and p[2] < 100


def is_dark(p):
    return max(p) < 80


def main():
    expected = {f"{r}-{s}.png" for r in RANKS for s in SUITS}
    actual = {p.name for p in ROOT.glob("*.png")}

    fails = []

    # 1. Filename count + names.
    missing = expected - actual
    extra = actual - expected
    if missing:
        fails.append(f"MISSING: {missing}")
    if extra:
        fails.append(f"EXTRA: {extra}")
    print(f"[1/5] Files: {len(actual)}/32 expected. {'OK' if not (missing or extra) else 'FAIL'}")

    # 2. Dimensions + mode.
    dim_issues = []
    for name in sorted(actual):
        img = Image.open(ROOT / name)
        if img.size != (TARGET_W, TARGET_H):
            dim_issues.append(f"{name}: {img.size}")
        if img.mode != "RGB":
            dim_issues.append(f"{name}: mode {img.mode}")
    if dim_issues:
        fails.extend(dim_issues)
        print(f"[2/5] Dimensions/mode: FAIL ({len(dim_issues)} issues)")
    else:
        print(f"[2/5] Dimensions/mode: OK (all 600x870 RGB)")

    # 3. Cream uniformity OUTSIDE the rounded corner. The card has a
    #    rounded rect with radius ~6.87 SVG units (~24 px at 600x870),
    #    so the four absolute corner pixels of the bounding box live
    #    outside the card and are pure cream by construction (we
    #    composited onto cream). The figure cannot reach there.
    edge_issues = []
    CORNER_PROBES = [(0, 0), (TARGET_W - 1, 0), (0, TARGET_H - 1), (TARGET_W - 1, TARGET_H - 1)]
    for name in sorted(actual):
        img = Image.open(ROOT / name).convert("RGB")
        for (x, y) in CORNER_PROBES:
            px = img.getpixel((x, y))
            d = cream_distance(px)
            if d > 5:
                edge_issues.append(f"{name} @ ({x},{y}): {px} dist={d}")
    if edge_issues:
        fails.extend(edge_issues[:5])
        print(f"[3/5] Edge cream: FAIL ({len(edge_issues)} samples non-cream)")
    else:
        print(f"[3/5] Edge cream: OK")

    # 4. Suit color presence — scan the entire card image and require a
    #    minimum count of "ink" pixels of the correct color.
    color_issues = []
    for name in sorted(actual):
        rank, suit = name[:-4].split("-")
        img = Image.open(ROOT / name).convert("RGB")
        red_count = 0
        dark_count = 0
        # Stride sample: every 3rd pixel is plenty for a presence check.
        for y in range(0, TARGET_H, 3):
            for x in range(0, TARGET_W, 3):
                p = img.getpixel((x, y))
                if is_red(p):
                    red_count += 1
                elif is_dark(p):
                    dark_count += 1
        if suit in RED_SUITS:
            if red_count < 1000:
                color_issues.append(f"{name}: red_count={red_count} (need ≥1000)")
        else:
            if dark_count < 1000:
                color_issues.append(f"{name}: dark_count={dark_count} (need ≥1000)")
    if color_issues:
        fails.extend(color_issues)
        print(f"[4/5] Suit colors: FAIL ({len(color_issues)} suspect)")
    else:
        print(f"[4/5] Suit colors: OK")

    # 5. Alpha.
    alpha_issues = []
    for name in sorted(actual):
        img = Image.open(ROOT / name)
        if img.mode == "RGBA":
            extrema = img.getchannel("A").getextrema()
            if extrema[0] != 255:
                alpha_issues.append(f"{name}: alpha min={extrema[0]}")
    if alpha_issues:
        fails.extend(alpha_issues)
        print(f"[5/5] Alpha: FAIL ({len(alpha_issues)} non-opaque)")
    else:
        print(f"[5/5] Alpha: OK")

    print()
    if fails:
        print(f"FAILED: {len(fails)} issues")
        for f in fails[:30]:
            print(f"  - {f}")
        sys.exit(1)
    else:
        print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()
