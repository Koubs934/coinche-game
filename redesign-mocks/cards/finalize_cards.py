"""Finalize the 32 normalized cards: mask the AI-baked corner marks,
draw fresh uniform corner marks (Cinzel for rank, system serif for
suit symbol), then draw a uniform rounded gold-brown border.

Output: redesign-mocks/cards/final/*.png — drop-in replacements for
the processed/ raster cards with mathematically identical frames
and corner geometry across all 32.
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "processed"
DST = ROOT / "final"
DST.mkdir(exist_ok=True)

CINZEL_PATH = ROOT / "fonts" / "Cinzel-SemiBold.ttf"
# Segoe UI Symbol has clean playing-card pip glyphs — better than
# Cinzel's stylized suit shapes for unambiguous suit recognition.
SUIT_FONT_PATH = "C:/Windows/Fonts/seguisym.ttf"

CARD_W, CARD_H = 400, 600

CREAM = (244, 232, 208)
BORDER_RGBA = (140, 110, 70, 115)  # ~0.45 alpha gold-brown
BORDER_WIDTH = 2
BORDER_RADIUS = 22

# Corner mark specs
RANK_SIZE = 56
SUIT_SIZE = 38
TL_RANK_POS = (28, 28)              # top-left, anchor of rank
TL_SUIT_POS = (28, 28 + RANK_SIZE + 6)  # suit slightly below rank

# Standard mask boxes — generous corner zones covering the full
# variation of AI-baked rank+suit indicators (figure cards D/R/V tend
# to have bigger or shifted marks).
TL_MASK = (8, 10, 115, 140)
BR_MASK = (285, 460, 392, 590)

# Per-rank override for "A": the AI tends to draw the central suit
# symbol next to the "A" larger and lower than for other ranks, so it
# leaks past TL_MASK's bottom edge. Extending vertically only — the
# Ace's central illustration sits at y≈300 (well below 175), so this
# is safe.
TL_MASK_A = (8, 10, 115, 175)
BR_MASK_A = (285, 425, 392, 590)

SUIT_SYMBOLS = {
    "coeur":   "♥",  # ♥
    "carreau": "♦",  # ♦
    "trefle":  "♣",  # ♣
    "pique":   "♠",  # ♠
}
SUIT_COLORS = {
    "coeur":   (178, 34, 34),
    "carreau": (178, 34, 34),
    "trefle":  (26, 26, 26),
    "pique":   (26, 26, 26),
}


def render_corner_marks(card, rank, suit):
    """Draw rank+suit at top-left and rotated 180° at bottom-right."""
    color = SUIT_COLORS[suit]
    symbol = SUIT_SYMBOLS[suit]
    font_rank = ImageFont.truetype(str(CINZEL_PATH), RANK_SIZE)
    font_suit = ImageFont.truetype(SUIT_FONT_PATH, SUIT_SIZE)

    # --- Top-left, drawn directly
    draw = ImageDraw.Draw(card)
    draw.text(TL_RANK_POS, rank, font=font_rank, fill=color)
    draw.text(TL_SUIT_POS, symbol, font=font_suit, fill=color)

    # --- Bottom-right, drawn on a transparent layer, rotated 180°, pasted
    # Layer must be the same size as the corner mark so rotation around
    # the layer center flips both glyphs correctly.
    layer_w, layer_h = 110, 110
    layer = Image.new("RGBA", (layer_w, layer_h), (0, 0, 0, 0))
    ldraw = ImageDraw.Draw(layer)
    ldraw.text((0, 0), rank, font=font_rank, fill=color + (255,))
    ldraw.text((0, RANK_SIZE + 6), symbol, font=font_suit, fill=color + (255,))
    layer = layer.rotate(180, expand=False)
    paste_pos = (CARD_W - 28 - layer_w, CARD_H - 28 - layer_h)
    card.paste(layer, paste_pos, layer)

    return card


def draw_border(card):
    """Draw a uniform rounded gold-brown border on the card.
    Uses an RGBA overlay so the border has the desired alpha
    against the cream background."""
    overlay = Image.new("RGBA", card.size, (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    # Inset by half the stroke so the line lives fully inside the canvas
    inset = BORDER_WIDTH / 2
    ov_draw.rounded_rectangle(
        [(inset, inset), (CARD_W - 1 - inset, CARD_H - 1 - inset)],
        radius=BORDER_RADIUS,
        outline=BORDER_RGBA,
        width=BORDER_WIDTH,
    )
    card_rgba = card.convert("RGBA")
    composed = Image.alpha_composite(card_rgba, overlay)
    return composed.convert("RGB")


def apply_soft_mask(img, mask_box, cream=CREAM, blur_radius=2):
    """Cover a corner zone with cream and blur the patch edges very
    lightly (radius 2) so the boundary fades into the underlying AI
    cream texture. The blur is small enough that the masked region
    interior stays fully opaque — old AI marks underneath cannot
    show through."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    odraw.rectangle(mask_box, fill=(*cream, 255))
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    img_rgba = img.convert("RGBA")
    img_rgba.alpha_composite(overlay)
    return img_rgba.convert("RGB")


def finalize_one(src_path):
    rank, suit = src_path.stem.split("-")
    img = Image.open(src_path).convert("RGB")

    # 1. Mask the AI-baked corner indicators with a softly-edged cream
    #    patch. Per-rank override for "A" — its AI corner mark is
    #    larger/lower and leaks past the standard mask bottom.
    if rank == "A":
        tl_box, br_box = TL_MASK_A, BR_MASK_A
    else:
        tl_box, br_box = TL_MASK, BR_MASK
    img = apply_soft_mask(img, tl_box)
    img = apply_soft_mask(img, br_box)

    # 2. Draw fresh corner marks
    img = render_corner_marks(img, rank, suit)

    # 3. Draw the uniform border
    img = draw_border(img)

    return img


def main():
    files = sorted(SRC.glob("*.png"))
    for f in files:
        out = finalize_one(f)
        out.save(DST / f.name, "PNG", optimize=True)
    print(f"Finalized {len(files)} cards -> {DST}")


if __name__ == "__main__":
    main()
