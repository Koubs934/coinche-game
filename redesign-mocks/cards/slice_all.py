"""Slice all 32 Coinche cards from the cream-modified master render.

Output: redesign-mocks/cards/paris-pro/{rank}-{suit}.png at 600x870.
"""

from PIL import Image
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "sources/master-cream.png"
OUT = ROOT / "paris-pro"
OUT.mkdir(exist_ok=True)

# SVG geometry: card base 166.575 x 235.27. ViewBox starts at (-0.2, -236).
# Open as RGBA: the rendered master has transparent area outside the
# rounded card corners (omitBackground=true). Compositing onto cream
# guarantees cream-colored corner pixels in the output PNGs.
img_rgba = Image.open(SRC).convert("RGBA")
W, H = img_rgba.size
CREAM = (244, 232, 208)
canvas = Image.new("RGB", (W, H), CREAM)
canvas.paste(img_rgba, (0, 0), img_rgba)
img = canvas
SCALE_X = W / 2178.99
SCALE_Y = H / 1216.19
VB_X, VB_Y = -0.2, -236
CARD_W_SVG, CARD_H_SVG = 166.575, 235.27

# Mapping: SVG (rank, suit) -> filename.
SUIT_FR = {"club": "trefle", "diamond": "carreau", "heart": "coeur", "spade": "pique"}
RANK_FR = {1: "A", 7: "7", 8: "8", 9: "9", 10: "10",
           "jack": "V", "queen": "D", "king": "R"}

# Source x-positions per rank index (column) in the master.
COL_X = {
    1:  0,
    7:  1005.45,
    8:  1173.02,
    9:  1340.6,
    10: 1508.17,
    "jack":  1675.75,
    "queen": 1843.32,
    "king":  2010.9,
}
# Source y-positions per suit (row) — base_y in the SVG.
ROW_Y = {
    "club":    0,
    "diamond": 243.137,
    "heart":   486.275,
    "spade":   729.412,
}

TARGET_W, TARGET_H = 600, 870


def slice_one(svg_rank, svg_suit):
    bx = COL_X[svg_rank]
    by = ROW_Y[svg_suit]
    top_svg = by - CARD_H_SVG
    left_px = (bx - VB_X) * SCALE_X
    top_px = (top_svg - VB_Y) * SCALE_Y
    right_px = left_px + CARD_W_SVG * SCALE_X
    bot_px = top_px + CARD_H_SVG * SCALE_Y
    box = (round(left_px), round(top_px), round(right_px), round(bot_px))
    crop = img.crop(box)
    # Resize to uniform dimensions with high-quality downsampling.
    out = crop.resize((TARGET_W, TARGET_H), Image.LANCZOS)
    return out


def main():
    n = 0
    for svg_rank, fr_rank in RANK_FR.items():
        for svg_suit, fr_suit in SUIT_FR.items():
            card = slice_one(svg_rank, svg_suit)
            name = f"{fr_rank}-{fr_suit}.png"
            card.save(OUT / name, "PNG", optimize=True)
            n += 1
    print(f"Wrote {n} cards to {OUT} at {TARGET_W}x{TARGET_H}")


if __name__ == "__main__":
    main()
