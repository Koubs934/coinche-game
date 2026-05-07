"""Build a contact sheet of all 32 normalized cards arranged in a
4-row x 8-col grid (rows = suits, cols = ranks low to high)."""

from PIL import Image
from pathlib import Path

SRC = Path(__file__).parent / "final"
OUT = Path(__file__).parent / "contact_sheet_final.png"

RANKS = ["7", "8", "9", "10", "V", "D", "R", "A"]
SUITS = ["coeur", "carreau", "trefle", "pique"]

CELL_W, CELL_H = 200, 300
sheet = Image.new("RGB", (CELL_W * 8, CELL_H * 4), (30, 60, 45))

for row, suit in enumerate(SUITS):
    for col, rank in enumerate(RANKS):
        path = SRC / f"{rank}-{suit}.png"
        if path.exists():
            card = Image.open(path).resize((CELL_W, CELL_H), Image.LANCZOS)
            sheet.paste(card, (col * CELL_W, row * CELL_H))

sheet.save(OUT)
print(f"Contact sheet -> {OUT}  ({sheet.size[0]}x{sheet.size[1]})")
