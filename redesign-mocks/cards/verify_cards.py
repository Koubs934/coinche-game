"""Programmatic verification of the 32 normalized cards.

Checks:
  1. All 32 expected files present, none extra.
  2. Every card is exactly 400x600 RGB.
  3. All 4 corners (3px from each edge) are within tolerance of cream.
"""

from PIL import Image
from pathlib import Path

SRC = Path(__file__).parent / "processed"
RANKS = ["7", "8", "9", "10", "V", "D", "R", "A"]
SUITS = ["coeur", "carreau", "trefle", "pique"]
CREAM = (244, 232, 208)
TOL = 15

issues = []
expected_files = {f"{r}-{s}.png" for r in RANKS for s in SUITS}
actual_files = {f.name for f in SRC.glob("*.png")}

# Check 1: file inventory
missing = expected_files - actual_files
extra = actual_files - expected_files
if missing:
    issues.append(f"MISSING: {sorted(missing)}")
if extra:
    issues.append(f"EXTRA: {sorted(extra)}")

# Check 2 & 3: dimensions, mode, and corner cream
for name in sorted(actual_files):
    img = Image.open(SRC / name)

    if img.size != (400, 600):
        issues.append(f"{name}: dim {img.size} (expected 400x600)")

    if img.mode != "RGB":
        issues.append(f"{name}: mode {img.mode} (expected RGB)")

    img_rgb = img.convert("RGB")
    pixels = img_rgb.load()

    # Sample the 4 corners 3px from each edge
    corners = [(3, 3), (3, 596), (396, 3), (396, 596)]
    for x, y in corners:
        px = pixels[x, y]
        if not all(abs(px[i] - CREAM[i]) <= TOL for i in range(3)):
            issues.append(f"{name}: corner ({x},{y}) = {px} not cream")
            break  # one finding per card is enough

# Report
print("\n" + "=" * 50)
print("VERIFICATION REPORT")
print("=" * 50)
print(f"Files found: {len(actual_files)}/32")
print(f"Issues: {len(issues)}")
if issues:
    print("\nISSUES:")
    for i in issues:
        print(f"  - {i}")
else:
    print("\nALL CHECKS PASSED")
