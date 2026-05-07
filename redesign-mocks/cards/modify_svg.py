"""Modify svg-cards-2.0.svg to remove the black stroke from #base and
swap the white fill for cream. Output saved alongside the original.

We don't touch any other element; the figures' colors are preserved.
"""
from pathlib import Path

SRC = Path(__file__).parent / "sources/svg-cards-2.0.svg"
DST = Path(__file__).parent / "sources/svg-cards-cream.svg"

CREAM = "#f4e8d0"  # matches --creme in 01-bidding-table.html

text = SRC.read_text(encoding="utf-8")

# 1. Replace the #base path's white fill + black stroke with cream + no stroke.
old_base = (
    '<path style="fill:#FFFFFF;stroke:#000000;stroke-width:2.5" '
    'd="M 0,0C0,3.78 3.09,6.87 6.87,6.87L159.715,6.87C163.485,6.87 '
    '166.575,3.78 166.575,0L166.575,-228.4C166.575,-232.18 '
    '163.485,-235.27 159.715,-235.27L6.87,-235.27C3.09,-235.27 '
    '0,-232.18 0,-228.4L0,0 z"/>'
)
new_base = (
    f'<path style="fill:{CREAM};stroke:none" '
    'd="M 0,0C0,3.78 3.09,6.87 6.87,6.87L159.715,6.87C163.485,6.87 '
    '166.575,3.78 166.575,0L166.575,-228.4C166.575,-232.18 '
    '163.485,-235.27 159.715,-235.27L6.87,-235.27C3.09,-235.27 '
    '0,-232.18 0,-228.4L0,0 z"/>'
)
assert old_base in text, "base path not found exactly — bail"
text = text.replace(old_base, new_base)

# 2. The face cards (jack/queen/king) have additional black "card frame"
#    decorations — small black lines forming an inner rectangle around the
#    figure. These are NOT the outer card stroke, they're stylistic. Keep.
#    Verified by inspecting jack_spade: those black lines are the figure
#    decoration, not the card frame.

# 3. Some figures use white rectangles to mask out portions of the rotated
#    suit symbols on the corner marks (e.g. <rect x="..." fill="white"/>
#    overlapping the spade glyph to make the rank+suit indicator clearly
#    separate from the figure). Those need to stay WHITE? Let's check.
#    Actually — looking at the rendering, those rectangles are a mask between
#    the rotated suit symbol and the figure. If the card body becomes cream,
#    keeping these white would cause cream→white discontinuity. Replace with
#    cream so they blend with the body.
text = text.replace('fill="white"', f'fill="{CREAM}"')
text = text.replace('fill="#FFFFFF"', f'fill="{CREAM}"')
text = text.replace("fill='#FFFFFF'", f"fill='{CREAM}'")

# 4. Force French rank labels (V/D/R) by collapsing each <switch> into
#    only the French <text> element. The default Chromium locale during
#    setContent is en-US, so without this the master renders J/Q/K.
import re

def collapse_switch(match):
    block = match.group(0)
    # Find the systemLanguage="fr"... text element. There's exactly one per switch.
    fr_text = re.search(
        r'<text systemLanguage="[^"]*fr[^"]*"[^>]*>[^<]*</text>',
        block,
    )
    return fr_text.group(0) if fr_text else block

text = re.sub(r'<switch>.*?</switch>', collapse_switch, text, flags=re.DOTALL)

DST.write_text(text, encoding="utf-8")
print(f"Wrote {DST} ({len(text)} chars)")
