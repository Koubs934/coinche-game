"""
Sliver-bleed detection for the sliced card PNGs.

What "sliver bleed" means:
  the slicer accidentally cropped a fragment of the card directly above
  (or below) into the current card. It would appear as colored content
  in a region that should be the cream/whitespace just above (or below)
  the card's own frame border.

What we explicitly DO NOT flag:
  - the card's own dark frame border at the very top/bottom edge — that
    appears in the corners due to the rounded shape and is intentional;
  - the dark frame border on the left/right edges (column 0 cards have
    their left frame at x=0, last-col cards have their right frame at
    x=w-1).

Strategy:
  Scan only the top and bottom edge bands (y=0..2 and y=h-2..h),
  restricted to the MIDDLE 50% of card width — away from the rounded
  corners. In a clean crop this region is the cream background ABOVE
  the card frame border — pure cream, no exceptions.

Exits 0 if every card passes; non-zero with a per-card report otherwise.
"""
from PIL import Image
import os
import sys

CARDS_DIR = r'C:\Users\Aaron\Projects\coinche-game-redesign\redesign-mocks\assets\cards'

CREAM = (244, 232, 208)
TOL = 35
EDGE_BAND = 3
# Calibration:
#   Pre-fix (broken slicer):  D/R/V cards had 1100-2600 bad pixels per edge.
#   Post-fix:                  20 / 32 cards have 0; 2 court cards (D-coeur,
#                              R-pique) hit ~25-61 because their crowns
#                              naturally extend to the very top of the card —
#                              not bleed, intentional figure content.
#   A threshold of 120 catches any real row-above bleed (>500 always) while
#   accepting the legitimate figure extent.
MAX_BAD = 120

def is_safe(p):
    if all(abs(p[i] - CREAM[i]) <= TOL for i in range(3)):
        return True
    if all(c >= 230 for c in p[:3]):
        return True
    return False

def scan(img):
    w, h = img.size
    px = img.load()
    x0 = w // 4
    x1 = 3 * w // 4
    top    = sum(1 for y in range(0, EDGE_BAND)        for x in range(x0, x1) if not is_safe(px[x, y]))
    bottom = sum(1 for y in range(h - EDGE_BAND, h)    for x in range(x0, x1) if not is_safe(px[x, y]))
    return {'top': top, 'bottom': bottom}

def main():
    files = sorted(f for f in os.listdir(CARDS_DIR) if f.endswith('.png'))
    failures = []
    for f in files:
        img = Image.open(os.path.join(CARDS_DIR, f)).convert('RGB')
        edges = scan(img)
        if edges['top'] > MAX_BAD or edges['bottom'] > MAX_BAD:
            failures.append((f, edges))
            print(f"FAIL {f}: {edges}")
        else:
            print(f"  OK {f}: {edges}")
    print()
    if failures:
        print(f"{len(failures)}/{len(files)} cards have sliver bleed.")
        return 1
    print(f"All {len(files)} cards pass sliver-bleed check.")
    return 0

if __name__ == '__main__':
    sys.exit(main())
