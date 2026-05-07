"""Convert language switches in the source SVG to French-only text labels."""
import re
src_path = r'C:\Users\Aaron\Projects\coinche-game-redesign\redesign-mocks\assets\cards-source\Svg-cards-2.0.svg'
out_path = r'C:\Users\Aaron\Projects\coinche-game-redesign\redesign-mocks\assets\cards-source\Svg-cards-2.0.fr.svg'

with open(src_path, encoding='utf-8') as f:
    s = f.read()

# Replace each <switch>...</switch> that contains a French <text> with just the French text
def replace_switch(m):
    block = m.group(0)
    # Find the text element with systemLanguage containing 'fr'
    fr_match = re.search(r'<text[^>]*systemLanguage="[^"]*\bfr\b[^"]*"[^>]*>([^<]*)</text>', block)
    if fr_match:
        # Reconstruct: take that text but strip systemLanguage attr
        full = fr_match.group(0)
        cleaned = re.sub(r'\s*systemLanguage="[^"]*"', '', full)
        return cleaned
    return block

s2 = re.sub(r'<switch>.*?</switch>', replace_switch, s, flags=re.DOTALL)
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(s2)
print(f"wrote {out_path}")
print(f"original size: {len(s)}, output size: {len(s2)}")
