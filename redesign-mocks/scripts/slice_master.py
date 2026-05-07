"""
Slice the rendered Wikimedia master deck PNG into 32 distinct cards.

Uses EMPIRICALLY-MEASURED row/column boundaries instead of SVG-to-px math.
The SVG-math approach was off by ~28 px (the SVG renders with a ~9-unit
internal offset that's not predictable from viewBox alone), causing two
bugs:
  - All clubs cards had ~7px of black sliver at the top (clipped above-card
    region)
  - All court cards had bleed from the bottom of the row above into the
    top of the crop

Empirical card geometry in the rendered 6600x3700 master PNG:
  - Card frame border at y=7 (top), y=725 (bottom) for clubs row
  - Row stride 729 px between top-borders, 10 px gap between row frames
  - Card frame border at x=0/x=493 for col 0; col stride 502 px
  - 13 columns x 4 rows = 52 cards (we use 8 ranks x 4 suits = 32)

We crop conservatively: 2 px margin in from each measured frame border to
guarantee zero bleed. Each output card is then resized to a uniform
600x870.
"""
from PIL import Image
import os
import shutil

# === Empirical geometry of source_master.png ===
# Top of each suit's row of card frames, in image-px:
ROW_Y_TOPS = {'club': 7, 'diamond': 736, 'heart': 1466, 'spade': 2195}
# Card height (top-of-frame to bottom-of-frame) in image-px:
CARD_H_PX = 718
# Column stride and starting x:
COL_X_STRIDE = 502
COL_X_START = 0
# Card width in image-px (frame to frame):
CARD_W_PX = 493
# Inset to guarantee no border-line bleed:
SAFETY_INSET = 2

# === Wanted ranks/suits (Coinche uses 7,8,9,10,A,V,D,R) ===
# col index in the rendered master (0=ace, 1=2, ..., 9=10, 10=jack, 11=queen, 12=king)
RANK_TO_COL = {
    'A':  0,
    '7':  6,
    '8':  7,
    '9':  8,
    '10': 9,
    'V':  10,  # jack
    'D':  11,  # queen
    'R':  12,  # king
}
SUIT_FR_TO_SVG = {
    'coeur':   'heart',
    'carreau': 'diamond',
    'trefle':  'club',
    'pique':   'spade',
}

# === Colors ===
CREAM = (244, 232, 208)  # --creme
WHITE_THRESH = 230       # pixels with all channels >= this become cream

def cream_tint(img):
    """Replace near-white background with cream while preserving illustrations."""
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r >= WHITE_THRESH and g >= WHITE_THRESH and b >= WHITE_THRESH:
                px[x, y] = CREAM
    return img

def main():
    src_path = r'C:\Users\Aaron\Projects\coinche-game-redesign\redesign-mocks\scripts\source_master.png'
    out_dir  = r'C:\Users\Aaron\Projects\coinche-game-redesign\redesign-mocks\assets\cards'
    backup_dir = r'C:\Users\Aaron\Projects\coinche-game-redesign\redesign-mocks\assets\cards-prev'

    src = Image.open(src_path).convert('RGB')

    # Backup existing PNGs (only PNGs — keep contact-sheet, back.svg untouched)
    os.makedirs(backup_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        if f.endswith('.png'):
            shutil.copy(os.path.join(out_dir, f), os.path.join(backup_dir, f))

    target_w, target_h = 600, 870  # output card size

    count = 0
    for suit_fr, suit_svg in SUIT_FR_TO_SVG.items():
        y_top = ROW_Y_TOPS[suit_svg]
        for rank_fr, col_idx in RANK_TO_COL.items():
            x_left = COL_X_START + col_idx * COL_X_STRIDE
            # Apply safety inset on all four sides (eats the dark border line
            # plus a hair of slack so no fragment of the row above can sneak in)
            crop_box = (
                x_left + SAFETY_INSET,
                y_top + SAFETY_INSET,
                x_left + CARD_W_PX - SAFETY_INSET,
                y_top + CARD_H_PX - SAFETY_INSET,
            )
            crop = src.crop(crop_box)
            crop = crop.resize((target_w, target_h), Image.LANCZOS)
            crop = cream_tint(crop)
            out_path = os.path.join(out_dir, f'{rank_fr}-{suit_fr}.png')
            crop.save(out_path, optimize=True)
            count += 1

    print(f"Wrote {count} cards to {out_dir}")
    print(f"Backed up old cards to {backup_dir}")

if __name__ == '__main__':
    main()
