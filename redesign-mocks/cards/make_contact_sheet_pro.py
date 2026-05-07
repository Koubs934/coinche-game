"""Generate an 8×4 contact sheet of paris-pro/ cards for visual inspection."""
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "paris-pro"
OUT = ROOT / "paris-pro-contact.png"

RANKS = ["7", "8", "9", "10", "V", "D", "R", "A"]
SUITS = ["coeur", "carreau", "trefle", "pique"]

CARD_W, CARD_H = 300, 435  # display size (hi-res for inspection)
PAD = 10
COLS = len(RANKS)
ROWS = len(SUITS)

W = COLS * CARD_W + (COLS + 1) * PAD
H = ROWS * CARD_H + (ROWS + 1) * PAD

sheet = Image.new("RGB", (W, H), (30, 50, 40))  # green felt-ish background
for r, suit in enumerate(SUITS):
    for c, rank in enumerate(RANKS):
        img = Image.open(SRC / f"{rank}-{suit}.png").convert("RGB")
        img = img.resize((CARD_W, CARD_H), Image.LANCZOS)
        x = PAD + c * (CARD_W + PAD)
        y = PAD + r * (CARD_H + PAD)
        sheet.paste(img, (x, y))

sheet.save(OUT, "PNG", optimize=True)
print(f"Wrote {OUT} ({W}x{H})")
