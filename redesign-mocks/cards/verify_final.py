"""Programmatic verification of the 32 finalized cards.

Checks:
  1. All 32 expected files present, none extra.
  2. Every card is exactly 400x600 RGB.
  3. The top-left corner-mark area contains non-cream pixels (proving
     the new corner mark was actually rendered, not just a cream patch).
"""

from PIL import Image
from pathlib import Path

SRC = Path(__file__).parent / "final"
RANKS = ["7", "8", "9", "10", "V", "D", "R", "A"]
SUITS = ["coeur", "carreau", "trefle", "pique"]
CREAM = (244, 232, 208)
TOL = 15

issues = []
expected = {f"{r}-{s}.png" for r in RANKS for s in SUITS}
actual = {f.name for f in SRC.glob("*.png")}

# Check 1: file inventory
missing = expected - actual
extra = actual - expected
if missing:
    issues.append(f"MISSING: {sorted(missing)}")
if extra:
    issues.append(f"EXTRA: {sorted(extra)}")

# Checks 2 & 3: dimensions, mode, and top-left corner-mark presence
for name in sorted(actual):
    img = Image.open(SRC / name)

    if img.size != (400, 600):
        issues.append(f"{name}: dim {img.size} (expected 400x600)")
        continue

    if img.mode != "RGB":
        issues.append(f"{name}: mode {img.mode} (expected RGB)")

    img_rgb = img.convert("RGB")
    pixels = img_rgb.load()

    # Sample pixels at the center of the top-left SUIT symbol (more
    # reliable than the rank — suit glyphs ♥♦♣♠ are filled solid
    # shapes whereas digits like "7" are mostly outline). Suit sits
    # at (28, 90) with font-size 38, so center is ~(47, 109).
    sample_points = [(40, 105), (47, 109), (54, 105), (47, 115)]
    any_inked = False
    for x, y in sample_points:
        px = pixels[x, y]
        if not all(abs(px[i] - CREAM[i]) <= TOL for i in range(3)):
            any_inked = True
            break
    if not any_inked:
        issues.append(f"{name}: top-left corner mark missing or invisible")

# Report
print("=" * 50)
print("FINAL CARD VERIFICATION")
print("=" * 50)
print(f"Files: {len(actual)}/32")
print(f"Issues: {len(issues)}")
if issues:
    print("\nISSUES:")
    for i in issues:
        print(f"  - {i}")
else:
    print("\nALL FINAL CARD CHECKS PASSED")
