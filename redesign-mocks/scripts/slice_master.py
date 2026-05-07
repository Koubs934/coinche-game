"""
Slice the rendered Wikimedia master deck PNG into 32 distinct cards.
- Uses authentic Paris-pattern figures (12 distinct courts: 4 jacks, 4 queens, 4 kings)
- Adds a subtle cream tint to the white background to fit the 1920s aesthetic
- Outputs to assets/cards/ as {V|D|R|7|8|9|10|A}-{coeur|carreau|trefle|pique}.png
"""
from PIL import Image, ImageOps, ImageEnhance, ImageChops
import os

# Source raster dimensions
IMG_W, IMG_H = 6600, 3700
# Source SVG viewBox: -0.2 -236 2178.99 1216.19
VB_X, VB_Y, VB_W, VB_H = -0.2, -236, 2178.99, 1216.19
# Note: master was rendered into a 6600x3700 image but viewport was 6537x3650 → so right/bottom 63x50 px is empty.
# Use the proper scale based on IMG_W=6537 / VB_W
ACTUAL_W = 6537
ACTUAL_H = 3650

CARD_W_SVG = 167.575
CARD_H_SVG = 243.137

def svg_to_px(x_svg, y_svg):
    sx = ACTUAL_W / VB_W
    sy = ACTUAL_H / VB_H
    return (x_svg - VB_X) * sx, (y_svg - VB_Y) * sy

# Card positions from source (use href base x/y → bottom-left)
# We extracted these earlier
positions = {
    # (rank, suit) -> (x_svg, y_svg) of base anchor (= bottom-left of card)
}
suit_map_svg_to_fr = {'club': 'trefle', 'diamond': 'carreau', 'heart': 'coeur', 'spade': 'pique'}
rank_map_svg_to_fr = {
    '1': 'A', '7': '7', '8': '8', '9': '9', '10': '10',
    'jack': 'V', 'queen': 'D', 'king': 'R',
}

# All 4 suits, anchor y from earlier scan: clubs y=0, diamonds y=243.137, hearts y=486.275, spades y=729.412
suit_y = {'club': 0, 'diamond': 243.137, 'heart': 486.275, 'spade': 729.412}
# Anchor x for ranks: rank 1..10 then jack queen king
rank_x = {
    '1': 0, '2': 167.575, '3': 335.15, '4': 502.725, '5': 670.3,
    '6': 837.875, '7': 1005.45, '8': 1173.02, '9': 1340.6, '10': 1508.17,
    'jack': 1675.75, 'queen': 1843.32, 'king': 2010.9,
}

# Coinche uses 7,8,9,10,A,V,D,R = these source ranks: 7,8,9,10,1,jack,queen,king
WANT = ['7', '8', '9', '10', '1', 'jack', 'queen', 'king']

src = Image.open(r'C:\Users\Aaron\Projects\coinche-game-redesign\redesign-mocks\scripts\source_master.png').convert('RGB')
out_dir = r'C:\Users\Aaron\Projects\coinche-game-redesign\redesign-mocks\assets\cards'
os.makedirs(out_dir, exist_ok=True)

# Backup old PNGs first
backup_dir = r'C:\Users\Aaron\Projects\coinche-game-redesign\redesign-mocks\assets\cards-prev'
os.makedirs(backup_dir, exist_ok=True)
for f in os.listdir(out_dir):
    if f.endswith('.png'):
        import shutil
        shutil.copy(os.path.join(out_dir, f), os.path.join(backup_dir, f))

# Cream tint color
CREAM = (244, 232, 208)  # --creme

def cream_tint(img):
    """Replace near-white with cream while preserving illustration colors."""
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            # If near-white (all channels >235), shift to cream
            if r > 230 and g > 230 and b > 230:
                # Blend toward cream
                px[x, y] = CREAM
    return img

def trim_borders(img, threshold=240):
    """Trim near-white edges before tinting (keep the natural card boundaries)."""
    return img  # disabled — we keep the master crops as-is for consistency

count = 0
for suit_svg, y_svg_anchor in suit_y.items():
    for rank_svg in WANT:
        x_svg_anchor = rank_x[rank_svg]
        # Card top-left in SVG coords:
        x_tl = x_svg_anchor
        y_tl = y_svg_anchor  # but anchor is BOTTOM of card... let me recheck
        # From scan: jack_spade base at (1675.75, 729.412) — and we cropped from (1675.75, 486.275).
        # So anchor y is BOTTOM, card top = anchor_y - CARD_H...
        # But for clubs (y=0), the card top would be at y=-243.137 in SVG which corresponds to viewBox y=-236, slightly above. That matches the viewBox starting at y=-236.
        x_tl_svg = x_svg_anchor
        y_tl_svg = y_svg_anchor - CARD_H_SVG  # top of card
        # Wait — my earlier crop for jack_spade used y=486.275 as top, which is 729.412 - 243.137 = 486.275 ✓
        # But for clubs (anchor y=0), top would be -243.137 which goes ABOVE viewBox start (-236) by 7px
        # Actually the viewBox starts at y=-236, height 1216.19, so it extends from -236 to +980.19. Clubs anchor is y=0, so card extends y=-243 to y=0... that's 7px above viewBox.
        # Hmm. Let me check the actual card positions in the rendered image instead by visual inspection.
        # Actually it's simpler to verify: club is the first row, located at viewBox y ~-236 to ~7. Let me just calc and crop, will verify visually.

        px_tl = svg_to_px(x_tl_svg, y_svg_anchor - CARD_H_SVG)
        px_br = svg_to_px(x_tl_svg + CARD_W_SVG, y_svg_anchor)
        crop = src.crop((int(px_tl[0]), int(px_tl[1]), int(px_br[0]), int(px_br[1])))
        # Resize to consistent card dimensions (target ~600x900 for crisp print)
        target_w = 600
        target_h = int(target_w * (CARD_H_SVG / CARD_W_SVG))
        crop = crop.resize((target_w, target_h), Image.LANCZOS)
        # Apply cream tint
        crop = cream_tint(crop)
        # Save
        rank_fr = rank_map_svg_to_fr[rank_svg]
        suit_fr = suit_map_svg_to_fr[suit_svg]
        out_path = os.path.join(out_dir, f'{rank_fr}-{suit_fr}.png')
        crop.save(out_path, optimize=True)
        count += 1

print(f"Wrote {count} cards to {out_dir}")
print(f"Backed up old cards to {backup_dir}")
