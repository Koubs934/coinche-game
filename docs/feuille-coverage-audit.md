# Feuille coverage audit — base sheet "EN OUVERTURES" vs `docs/la-feuille-v2.md`

**Read-only audit (2026-06-06).** Compares the handwritten base-sheet OPENINGS rules
(the reference, transcribed below) against the digitized Feuille the bot reads
(`docs/la-feuille-v2.md`). **No edit to la-feuille-v2.md** — adding content is a
separate Sacha/Jeje governance call. Scope: the OPENINGS section only (what the photos
show); v2.md covers other areas (responses, V2.2 categories) out of scope here.

## Headline

- **Most opening *rules* exist somewhere in v2.md (~80% content coverage), but the
  OPENINGS *section* is structurally reorganized**: the base sheet's pièce-based
  opening ladder (90→140) appears in v2.md as the **"Réponses sur ouverture 80"**
  table, not as openings. v2.md's *opening* table for 100/110/120 uses a different
  (maître-based / bicolore-shape) model.
- **Direct yes/no — is the 120 bicolore-*barrage* rule in v2.md?**
  **Partially — the actionable rule yes, the "barrage" concept no.** The 120-bicolore
  *shape* (opening) and the *restrictive raise-to-130* response (130 only with 3 As or
  a pièce, else pass even at 2 As, because partner may be bicolore) ARE present
  (lines 29, 70–77). But the word **"barrage" appears 0 times**, and the barrage
  *rationale* — "un barrage dépend du jeu, compter les points qu'on risque de perdre
  pour monter" — is **absent**. v2.md frames 120 bicolore as a value/ruffing bid, not a
  barrage. So a 120 reasoned as a *barrage* (or a value-120 *opening* = pièce 3ème) is
  genuinely uncovered → this explains the bot's "120 bicolore not covered".

## Per-rule status

### A) Opening ladder (pièce = belote = Valet/9 d'atout)

| Base-sheet rule | Status | v2.md |
|---|---|---|
| 80 = 2 As, petit jeu | ✅ PRESENT (opening) | Openings: `80 \| Au moins 2 As + petit jeu` (l.32) |
| 90 = pièce en seconde, ou « pas le 9 sec » ; valet sec tu peux | ⚠️ DIFFERENT (relocated) | Match is under **Réponses sur 80**: `90 \| Valet sec OU pièce 2nde… ❌ Jamais 9 sec` (l.46). v2.md's *opening* 90 is different (requires +1 As: `Pièce 4ème + 1 As ext / Valet 3ème + belote + 1 As ext / V+9+1 autre atout + 1 As ext`, l.33) |
| 100 = pièce + 1 As | ⚠️ DIFFERENT (relocated) | Under **Réponses sur 80**: `100 \| Pièce + 1 As` (l.47). v2.md *opening* 100 = `Maître à l'atout (sans As ext)` (l.31) |
| 110 = pièce + 2 As | ⚠️ DIFFERENT (relocated) | Under **Réponses sur 80**: `110 \| Pièce + 2 As` (l.48). v2.md *opening* 110 = `Maître + 1 As extérieur` (l.30) |
| 120 = pièce 3ème (3 cartes) ou plus | ⚠️ DIFFERENT (relocated) | Under **Réponses sur 80**: `120 \| Pièce 3ème` (l.49). v2.md *opening* 120 is **bicolore only** (l.29) — no value-120 opening |
| 130 = pièce 3ème + 1 As | ⚠️ DIFFERENT (relocated) | Under **Réponses sur 80**: `130 \| Pièce 3ème + 1 As` (l.50). Not an opening in v2.md |
| 140 = pièce 3ème + 2 As | ⚠️ DIFFERENT (relocated) | Under **Réponses sur 80**: `140 \| Pièce 3ème + 2 As` (l.51). Not an opening in v2.md |

> The (value, condition) pairs match v2.md **exactly** — but v2.md files the 90→140
> pièce ladder as *responses to an 80 opening*, while the base sheet lists it under
> *openings*. Real structural divergence; the rules themselves are not lost.

### B) 90 alternatives + montée

| Base-sheet rule | Status | v2.md |
|---|---|---|
| 90 alts: 9 4ème +1 As ; Valet 4ème +1 As ; Valet 3ème + belote +1 As ; V9 3ème + As | ✅ PRESENT (opening) | Openings 90 (l.33): `Pièce 4ème + 1 As ext` (covers 9-4ème & Valet-4ème, pièce=V or 9) / `Valet 3ème + belote (V+K+Q) + 1 As ext` / `V + 9 + 1 autre atout + 1 As ext` |
| Tu montes si : pièce en seconde ou +, 120, ou 3 As | ✅ PRESENT (as responses-to-90) | Réponses sur 90: `110 \| Pièce 2nde + 1 As` (l.58), `120 \| Pièce 3ème + 1 As OU 3 As` (l.59) |
| 100 : ou moins, 1 atout + 1 As | ✅ PRESENT | Réponses sur 90: `100 \| ≥1 atout + 1 As (sans pièce)` (l.57) |
| 110 : ou moins, 1 atout + 2 As | ⚠️ DIFFERENT | v2.md's 110-on-90 = `Pièce 2nde + 1 As` (l.58), **not** "1 atout + 2 As". The "1 atout + 2 As" path to 110 isn't listed (V2.1 history l.133 documents the pièce-2nde→110 correction) |

### C) Mettre à l'atout (+10 par As même si pas atout)

| Base-sheet rule | Status | v2.md |
|---|---|---|
| 100 min = V9 As 4ème (+10 par As même si pas atout) | ⚠️ PARTIAL/DIFFERENT | The **value** is present: `100 \| Maître à l'atout` (l.31, maître = V+9+As, l.11). But the **"+10 par As même si pas atout" additive as an *opening* mechanic** is absent from openings; v2.md only uses `+10 par As extérieur` for **responses** (sur 100, l.64; sur 110, l.68) |
| 110 = V9 As 4ème min + 1 As (+10/As même si pas atout) | ⚠️ PARTIAL/DIFFERENT | Value present: `110 \| Maître + 1 As extérieur` (l.30). Beyond +1 As, v2.md openings have **no additive +10/As path** — they jump to 120 bicolore (shape), so 120/130 openings via "+10 per As" are not modeled |

### D) 120 Bicolore Barrage (the one the bot said "not covered")

| Base-sheet rule | Status | v2.md |
|---|---|---|
| 120 bicolore exists | ✅ PRESENT (as value-shape opening) | `120 bicolore \| Maître à l'atout + ≥1 autre atout + strictement 2 couleurs` (l.29); logic l.36 ("couper les As adverses") |
| Monter à 130 SEULEMENT si 3 As ou la pièce ; 2 As → passer | ✅ PRESENT (with rationale) | Réponses sur 120 bicolore: `130 \| 3 As OU une pièce d'atout` / `Pass \| Sinon (même avec 2 As)` (l.74–75); rationale "le partenaire peut être bicolore… 2 As seuls ne couvrent pas" (l.77) ≈ base's "le partenaire peut être bicolore et on a les mauvais" |
| Concept "barrage" (bid de blocage ; compter les points qu'on risque de perdre pour monter) | ❌ MISSING | The word **"barrage" appears 0 times** in v2.md. The points-at-risk cost/benefit reasoning is absent. v2.md frames 120 bicolore as a **value/ruffing** bid, not a barrage. (Closest: the V2.2 **"Défense / Bloquage"** category, l.242–258 — a *general* blocking concept, marked "à implémenter", not tied to the 120-bicolore opening) |

### E) Capot

| Base-sheet rule | Status | v2.md |
|---|---|---|
| Compter ses perdantes en sachant les plis du partenaire vu ces annonces | ✅ PRESENT (verbatim-equivalent) | `Capot : non formalisé en V2. Heuristique générale : compter ses perdantes en tenant compte des plis que le partenaire est censé faire selon son annonce` (l.85) |

## Coverage summary (OPENINGS only)

- **Rough content coverage ≈ 80%**: nearly every base-sheet opening rule has a
  counterpart *somewhere* in v2.md.
- **Structural mismatch** (not a content loss, but a classification gap): the base
  sheet's pièce-based opening ladder (90→140) is in v2.md under **"Réponses sur
  ouverture 80"**, not openings; v2.md's openings for 100/110/120 use a maître /
  bicolore-shape model instead.
- **Genuine gaps (absent from v2.md):**
  1. **The "barrage" concept** — no "barrage", no points-at-risk reasoning for raising.
  2. **"+10 par As même si pas atout" as an *opening* additive** (present only for
     responses to 100/110).
  3. **A value-120 *opening*** (pièce 3ème) and additive 120/130/140 openings — present
     only as responses-to-80.
  4. **110-on-90 = "1 atout + 2 As"** path (v2.md requires pièce 2nde + 1 As).

## Direct answer

**Is the 120 bicolore-barrage rule in v2.md? — No, not as a *barrage*.** The
120-bicolore *shape* opening and the restrictive raise-to-130 *response* are present
(l.29, 74–77), but the *barrage concept* (the word, and the "count the points you risk
losing to decide whether to raise" logic) is absent. So a 120 reasoned as a barrage — or
a value-120 opening — is genuinely uncovered, which is consistent with the bot's
"bicolore = 120 not covered."
