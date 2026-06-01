# Sacha V2.2 conversations — hallucination audit

**Date**: 2026-05-07
**Snapshot**: `backend/data/training/_sacha-v22-snapshot/` (pulled fresh from prod, 90 annotation files)
**Source of truth**: `docs/la-feuille-v2.md`
**Sample**: 15 V2.2 conversations with `claude_conversation` and ≥1 message
**Sacha userId**: `507f441f-a481-4269-9d18-356b9ba76f43`

---

## 1. Executive summary

- **15 conversations audited.** 4 are multi-turn (31, 11, 7, 5 messages); 11 are opener-only (Claude posed a question, Sacha navigated away without replying).
- **88 Claude factual messages total** across the 15 conversations (claude_msgs in the corpus).
- **31 distinct factual claims about the convention** were extracted and classified.
- **Breakdown**: EXACT 16 · APPROXIMATE 5 · EXTRAPOLATED 1 · **HALLUCINATED 9**.
- **Hallucination rate**: 9/31 = **29 %** of all factual claims, concentrated in 5/15 conversations.
- **Top pattern**: Claude invents *capot* criteria when la Feuille is explicit that capot is not formalized — 3 separate hallucinations in 3 different conversations.
- **Severity: HIGH**. The single worst incident (conv 14, validation-scenario-03) has Claude *accusing Sacha of disagreeing with la Feuille* when Sacha is actually agreeing with it. Sacha confirmed feedback ("Claude keeps inventing rules") matches the data exactly.

---

## 2. Hallucination audit (the meat)

### 2.1 By severity

#### 🔴 P0 — Direct misrepresentation of a V2.1 rule (1 cluster, 4 turns in 1 conversation)

**Conv 14 — `validation-scenario-03`** (PASS expected; Sacha bid 80 ♣ ; Sacha hand: A♠ K♠ A♥ 10♥ 7♥ A♦ 8♣ 7♣)

| # | Claude's claim | What la Feuille actually says | Severity |
|---|---|---|---|
| H1 | "L'ouverture 80 promet **exactement 2 As** — ni plus, ni moins" | "Au moins 2 As + petit jeu" (line 32). V2.2 ADC mapping confirms "au moins 2" (line 165). | P0 |
| H2 | "La Feuille dit que 80 promet exactement 2 As — pas 3" (restatement after Sacha tries to clarify) | Same as H1. ≥2, not =2. | P0 |
| H3 | "Si tu en as 3, la Feuille ne couvre pas ce cas — elle ne dit pas 'ouvre 80 avec 3 As'" | She does — implicitly via "≥2". The actual reason scenario 3 = PASS is that **the hand has no pièce and fails the petit-jeu requirement**, *not* that 3 As is too many. | P0 |
| H4 | When Sacha replies "Oui 80 c'est promesse de 2 as ou plus", Claude responds: "OK donc pour toi 80 = 'au moins 2 As', pas 'exactement 2 As'. C'est une **divergence directe avec la Feuille**." | The exact opposite — Sacha's reading IS la Feuille's reading. Claude has accused the user of dissent for restating the official rule. | P0 |

**Root cause hypothesis**: Claude appears to have synthesized "exact" promises from the V2.2 ADC mapping table (where 90/100/110 use "exactly N" language) and over-generalized to 80 (whose actual mapping says "au moins 2"). Combined with the absence of a per-row guard, the system prompt didn't inhibit Claude from arguing against the user's correct restatement.

#### 🔴 P0 — Capot rule fabrication (3 conversations)

La Feuille V2 line 85: *"Capot : non formalisé en V2. Heuristique générale : compter ses perdantes en tenant compte des plis que le partenaire est censé faire selon son annonce, plutôt que de compter ses cartes fortes."* No mechanical criteria exist.

| # | Conv | Claude's invention |
|---|---|---|
| H5 | 1 (`08-competitive-8`) | "Pour le capot **il en faut 4 [As] en tout** — où tu trouves le 4ème ?" — fabricated 4-As capot threshold. |
| H6 | 8 (`opening-04-maitre-bicolore-7-1-side`) | "Le capot nécessite une **domination quasi-totale et des As extérieurs solides**" — fabricated criteria. |
| H7 | 13 (`validation-14` first try) | "Qu'est-ce qui te fait penser que ça suffit pour **250 points** ?" — wrong capot value. Project convention (CLAUDE.md): capot = 500 pts. |

**Root cause hypothesis**: Claude has zero anchor for capot in la Feuille, but the conversational pattern "scenario → expected → divergence → quiz" puts pressure on Claude to produce *something*. With no rule to cite, Claude generates plausible-sounding heuristics. The system prompt's anti-fabrication guard is not catching capot specifically.

#### 🟠 P1 — Mechanical-rule fabrication on response paths (2 conversations)

| # | Conv | Claude's claim | la Feuille actually says |
|---|---|---|---|
| H8 | 9 (`opening-05-maitre-bicolore-6-2-side`) | "120 bicolore (maître à l'atout + bicolore **4+/4+**)" | "Maître + ≥1 autre atout + cartes réparties dans **strictement 2 couleurs**" (line 29). No 4+/4+ split required. Validation scenarios in la Feuille include 5+3 (#15) and 4+4 (#14) — any distribution works. |
| H9 | 11 (`overcall-03-partner-90h-opp-100s`) | "Pièce 3ème = **110 de base**, +10 pour l'As d'atout" | No "110 de base" exists for pièce 3ème in any V2.1 response table. On 80 opening, pièce 3ème = 120. On 90 opening, pièce 3ème + 1 As = 120. There is no pièce-3ème-=-110 row anywhere in la Feuille. |

**Root cause hypothesis**: Claude is constructing a mental "additive bidding ladder" (base + bonuses) that isn't how V2.1 works. V2.1 is a lookup table, not a formula. The bot's V2.2 ADC formula (`relance + signalable_aces × 10`) may have leaked into how Claude reasons about V2.1 base lookups.

#### 🟡 P2 — Numeric/factual error (1 instance)

| # | Conv | Claude's claim | Reality |
|---|---|---|---|
| H10 | 15 (`validation-14` second try) | "Les adversaires ont en tout 5 atouts restants (**9 atouts total** - 4 tiens)" | A 32-card deck has **8 cards per suit**, not 9. So 8 trumps total, opponents+partner share 4 (not 5). |

This is factually wrong but tactical, not a la-Feuille rule claim. Still — basic Coinche literacy. Marked as a factual error rather than a la-Feuille hallucination.

### 2.2 APPROXIMATE claims (right answer, off articulation)

| Conv | Claim | Why approximate |
|---|---|---|
| 5 (`raise-partner-90-hearts`) | "La Feuille dit 110 (pièce 2nde = 110, point final)" | True in this case (Sacha had pièce 2nde + 1 As) but the rule actually requires the As. Phrasing suggests pièce-2nde alone → 110, which would be wrong without the As. |
| 6 (`validation-15`) | "120 bicolore (maître à l'atout + 4+ atouts + couleur secondaire)" | Misses the *strictement 2 couleurs* constraint. Substantively right for Sacha's hand but the articulation could mislead. |
| 13 (`validation-14` first try) | "Maître à l'atout + une longue extérieure — c'est exactement la définition du 120 bicolore" | Conflates "bicolore" with "long secondary suit". Real rule is about distribution = 2 suits, not about length. |
| 15 (`validation-14` second try) | "Le signal 'bicolore + maître à l'atout'" | Same as above, slightly looser. |

### 2.3 EXACT claims (Claude got these right)

- 10 instances of "La Feuille ne couvre pas ce cas (overcall adverse sur ouverture partenaire)" — all correct per V2.2 line 124 ("Annonces compétitives — pas couvert").
- "Maître à l'atout = J + 9 + A" (conv 15, line 11 of doc) ✓
- "Le J est le meilleur atout" (conv 1) ✓
- "Ouverture 80 promet 2 As" (conv 1, ≥2 rendered as a minimum) ✓
- "Ouverture 90 du partenaire promet déjà 1 As ext" (conv 5) ✓ — V2.2 ADC mapping
- "Elle fixe 120 sur la force de la main, pas sur l'espérance de points" (conv 6) ✓ — V2.1 is hand-based
- "La Feuille ne couvre pas de bonus pour la belote dans l'ouverture" (conv 9) ✓ — negative space, accurate
- "Maître = J+9+A, pas J+9+A+K+Q — le K♥ n'est pas automatiquement sécurisé" (conv 15) ✓
- 5–6 hand description statements (e.g. "tu as pièce 4ème ♠")

### 2.4 EXTRAPOLATED (V2.2 principle applied beyond V2.1 letter)

- Conv 5: "Si tu signales un As de plus tu en aurais 2" — applies V2.2 ADC reasoning to a direct response (not a re-relance). Borderline acceptable as ADC-style coaching.

---

## 3. Per-conversation analysis

### Conv 1 — `partner-opened-opp-overcalled-08-competitive-8` (31 msgs, capot ♠, rule-silent) ⭐
- **Cards selected**: J♠ 9♠ Q♠ 7♠ A♦
- **Action**: bid capot ♠ (rule-silent — overcall scenarios not in V2)
- **Length**: 31 messages (15 user / 16 claude). Deepest conversation in the corpus.
- **Hallucinations**: 1 (H5 — "il en faut 4 As pour le capot")
- **Summary**: Sacha defends capot via a sophisticated chain of reasoning: J+9 in his hand makes ♠ maître automatic for his side, partner's 80 promises ≥2 As + le 21 (A+10) somewhere to cover Sacha's perdantes, partance lets partner draw atout first. Claude pokes at the trick logic, makes a confused "J under A" remark, Sacha corrects ("le valet est plus fort à l'atout"), Claude concedes. Sacha then corrects Claude further ("j'ai les 2 pièces 4ème, le 34") — Claude updates the candidate rule.
- **Quality**: HIGH — this is exactly the kind of human reasoning the V2.2 calibration wants. One hallucinated capot threshold, otherwise productive.
- **Notable**: Claude proposes promoting "maître 4ème + 1 As ext + ouverture 80 partenaire + partance → capot" as a candidate rule. This is *exactly* the right behavior for rule-silent territory — flagged as candidate, not asserted.

### Conv 2 — `partner-opened-opp-overcalled-09-competitive-9` (1 msg, 130 ♠, rule-silent)
- **Cards**: Q♠ 7♠ 9♠ J♠ (pièce 4ème, longue-S-4)
- **Hallucinations**: 0
- **Summary**: Claude correctly says rule-silent and asks Sacha for his arithmetic. Sacha navigated away.
- **Quality**: clean opener, no engagement.

### Conv 3 — `partner-opened-opp-overcalled-10-competitive-10` (1 msg, 130 ♠, rule-silent)
- **Cards**: J♠ 9♠ 10♠ 7♠
- **Hallucinations**: 0
- **Summary**: Same shape as conv 2. Correct rule-silent. Sacha navigated.
- **Quality**: clean opener.

### Conv 4 — `partner-opened-opp-overcalled-15-competitive-15` (1 msg, 140 ♠, rule-silent)
- **Cards**: J♠ 9♠ 10♠ 7♠ A♦
- **Hallucinations**: 0
- **Summary**: Correct rule-silent. Claude observes Sacha didn't select K♥/K♣. Sacha navigated.
- **Quality**: clean opener.

### Conv 5 — `raise-partner-90-hearts` (1 msg, 130 ♥, value-different)
- **Cards**: 9♥ 10♥ A♦ (pièce 2nde + 1 As ext) — V2.1 expected: **110**
- **Hallucinations**: 0 (1 APPROXIMATE — "pièce 2nde = 110, point final")
- **Summary**: Claude correctly cites 110 as the V2.1 answer and surfaces V2.2 ADC reasoning ("90 promises 1 As ext, so an extra would be a 2nd"). Sacha navigated.
- **Quality**: solid opener.

### Conv 6 — `validation-scenario-15` (11 msgs, capot ♠, value-different) ⭐
- **Cards**: J♠ 9♠ A♠ K♠ Q♠ A♥ 10♥ 7♥ — V2.1 expected: **120 bicolore ♠**
- **Hallucinations**: 0 (1 APPROXIMATE on 120-bicolore framing)
- **Summary**: Sacha argues capot via score logic ("capot = 500 pts, le risque est mesuré, je ne perds qu'un pli si quelqu'un a roi 3ème ♥"). Claude correctly notes la Feuille is hand-based not score-based. They circle without resolution; Sacha asserts "je dois annoncer capot avec ce jeu" and Claude pushes back. Conversation ends without resolution (`ended_reason=null`).
- **Quality**: useful — Sacha's score-based reasoning for capot is a candidate V2.2 capot rule fragment, but Claude correctly doesn't assert it as la Feuille canon.

### Conv 7 — `opening-01-maitre-and-3-outside-aces` (1 msg, 130 ♠, value-different)
- **Cards selected**: J♠ 9♠ A♥ A♦ A♣ — V2.1 expected: **110** (palier d'ouverture stays 110 even with extra As ext, per scenario 13 of la Feuille)
- **Hallucinations**: 0
- **Summary**: Claude correctly cites 110. Probes Sacha's "+10 per As ext" mental model. Sacha navigated.
- **Quality**: clean opener, accurate.

### Conv 8 — `opening-04-maitre-bicolore-7-1-side` (1 msg, capot ♠, value-different)
- **Cards**: A♠ K♠ Q♠ A♥ 9♠ J♠ 10♥ K♥ — V2.1 expected: **120 bicolore ♠**
- **Hallucinations**: 1 (H6 — "capot nécessite domination quasi-totale + As ext solides")
- **Summary**: Claude opens with the right answer (120 bicolore) and immediately fabricates capot criteria. Sacha navigated.
- **Quality**: poisoned opener — first message contains a hallucination.

### Conv 9 — `opening-05-maitre-bicolore-6-2-side` (1 msg, 150 ♥, value-different)
- **Cards**: K♥ Q♥ 10♥ A♥ 9♥ J♥ A♣ + 1 — V2.1 expected: **120 bicolore ♥**
- **Hallucinations**: 1 (H8 — "bicolore 4+/4+")
- **Summary**: Claude cites 120 bicolore but with a fabricated 4+/4+ split rule. Sacha navigated.
- **Quality**: poisoned opener.

### Conv 10 — `partner-opened-opp-overcalled-02-partner-100s-opp-110h` (1 msg, 120 ♠, rule-silent)
- **Cards**: Q♠ K♠ 10♠ (belote)
- **Hallucinations**: 0
- **Summary**: Correct rule-silent. Claude probes Sacha's belote-driven raise. Sacha navigated.

### Conv 11 — `partner-opened-opp-overcalled-03-partner-90h-opp-100s` (1 msg, 120 ♥, rule-silent)
- **Cards**: 9♥ A♥ K♥ (pièce 3ème + As d'atout)
- **Hallucinations**: 1 (H9 — "pièce 3ème = 110 de base")
- **Summary**: Claude correctly says rule-silent, then fabricates a 110-base + 10-bonus formula. Sacha navigated.
- **Quality**: poisoned opener.

### Conv 12 — `partner-opened-opp-overcalled-05-partner-110s-opp-120h` (1 msg, 140 ♠, rule-silent)
- **Cards**: 10♠ K♠ Q♠ 8♠ (belote, longue-S-4)
- **Hallucinations**: 0
- **Summary**: Correct rule-silent. Claude even surfaces the V2.2 *bloquage* category ("tu bloques les adversaires ?"). Sacha navigated.
- **Quality**: best opener — invokes the right V2.2 vocabulary.

### Conv 13 — `validation-scenario-14` (1 msg, capot ♥, value-different) — first attempt
- **Cards**: J♥ 9♥ A♥ K♥ A♣ 10♣ 9♣ 8♣ — V2.1 expected: **120 bicolore ♥**
- **Hallucinations**: 1 (H7 — "ça suffit pour 250 points")
- **Summary**: Claude says 120 with a slightly off articulation, then asks "250 points?" — wrong capot value. Sacha navigated.
- **Quality**: poisoned opener.

### Conv 14 — `validation-scenario-03` (5 msgs, 80 ♣, action-type-different) ⭐ **WORST**
- **Cards selected**: A♥ 10♥ A♦ A♠ — V2.1 expected: **PASS** (no pièce, fails petit jeu)
- **Hallucinations**: 4 (H1, H2, H3, H4 — the "exactly 2 As" cluster)
- **Summary**: This is the smoking gun for Sacha's complaint. Claude:
  1. Asserts 80 promises *exactly* 2 As (wrong — la Feuille says ≥2).
  2. Says la Feuille "ne dit pas 'ouvre 80 avec 3 As'" (wrong — she does, implicitly).
  3. Frames Sacha's correct restatement ("80 c'est promesse de 2 as ou plus") as a "**divergence directe avec la Feuille**".
  4. Constructs a hypothetical partner-confusion scenario based on the "exactly 2" misreading.
- **What la Feuille actually says** (line 32, line 97): 80 = ≥2 As + petit jeu. Scenario 3 PASSES because hand has 0 pièces and fails petit jeu — *not* because of As count.
- **Quality**: ❌ The single most damaging conversation in the corpus. Sacha is correct; Claude tells him he's wrong.

### Conv 15 — `validation-scenario-14` (7 msgs, capot ♥, value-different) — second attempt
- **Cards**: 8♣ 9♣ J♥ 9♥ A♥ K♥ A♣ 10♣ — V2.1 expected: **120 bicolore ♥**
- **Hallucinations**: 1 (H10 — "9 atouts total")
- **Summary**: Claude opens correctly (120), Sacha defends capot via "j'ai la partance + je tire atout d'abord", Claude probes trick math and miscounts the deck (9 atouts). Sacha keeps defending. Conversation ends mid-debate.
- **Quality**: mixed — productive coaching dialogue but contaminated by a basic deck-composition error.

---

## 4. Vocabulary patterns from Sacha

### Terms Sacha uses (from his 25 messages across 4 multi-turn conversations)

**V2.1 glossary terms (he knows these):**
- *pièce 2nde / 3ème / 4ème* (conv 1, repeated)
- *maître à l'atout* (conv 1)
- *petit jeu* (conv 14, used correctly)
- *belote* (conv 6)
- *l'antibelote* (conv 1, possibly his slang for "we hold the K+Q so opponents can't")

**Domain slang / table-talk French (his own register):**
- *le 34* = J+9 of trump as a unit (conv 1: "j'ai les 2 pièces 4ème (le 34: valet et 9 d'atout)")
- *le 21* = A+10 in same suit (conv 14: "3 as extérieur dont un 21 (as +10)")
- *partance* = who has the deal/leads first trick (conv 1, conv 15)
- *fausse annonce* = misrepresented hand (conv 1)
- *plies* (= plis), *perdantes*, *capot c'est 500 pts de marque*
- *à l'atout le valet est plus fort* — concrete card knowledge

**Terms he NEVER uses:**
- *chiquer* (V2.2 category) — never
- *bloquer* / *défense* (V2.2 categories) — never
- *anti-double-comptage* / *ADC* — never
- *exploration* / *re-relance* — never
- *signalable* — never

### Pushback events

In every multi-turn conversation, Sacha pushes back on Claude:

| Conv | Pushback | What he corrected |
|---|---|---|
| 1 | "Nn a l'atout le valet est plus fort" | Claude's confused "J under A" remark |
| 1 | "Nn j'ai les 2 pièces 4ème (le 34: valet et 9 d'atout)" | Upgraded Claude's "pièce 4ème" candidate to "maître 4ème" |
| 6 | "Nn Claude la belote ne sert pas au capot" | Claude framed belote as the reason for capot |
| 14 | "Oui 80 c'est promesse de 2 as ou plus" | Claude's "exactly 2 As" hallucination — Sacha got accused of disagreeing with la Feuille for stating it correctly |
| 15 | "Nn pardon si quelqu'un a roi 3ème à cœur" | Self-correction (he meant ♥ not ♦) |
| 15 | "Je ne compte pas sur lui mon jeu me suffit" | Defends his capot logic against Claude's risk-poking |

**Sacha never accepts a hallucinated rule passively.** When Claude invents, Sacha either corrects directly ("Nn") or talks past it. He doesn't appear to be misled — but the hallucinations cost time and create friction.

### Linguistic register

Sacha writes in casual French with phonetic spellings ("nn", "perde", "plies", "as +10"). He uses real-table Coinche slang. He does NOT speak in the V2.2 vocabulary the system prompt is trying to teach. **For calibration purposes, his contributions are valuable as ground-truth bidding intuition expressed in native player vocabulary**, not as V2.2-doctrine training data.

---

## 5. Pattern detection

### Where do hallucinations cluster?

| Bucket | Count | Notes |
|---|---|---|
| **Capot scenarios** | 3/3 hallucinations (H5, H6, H7) | Whenever a Sacha capot bid appears, Claude invents capot criteria. 100 % hit rate. |
| **80 opening with 3+ As** | 4/4 in conv 14 (H1–H4) | One scenario, four turns reinforcing the same hallucination. |
| **Bicolore opening** | 1/3 hallucinations (H8) | "4+/4+" is invented; the other two bicolore scenarios are merely APPROXIMATE. |
| **Response-on-90 (rule-silent overcall)** | 1 hallucination (H9) | "Pièce 3ème = 110 de base". |
| **Tactical math** | 1 (H10) | Wrong deck composition (9 atouts). |
| **Pure rule-silent overcall scenarios** (without capot) | 0 hallucinations | Claude says "ne couvre pas ce cas" cleanly when there's no value-different judgement to argue against. |

**Key observation**: hallucinations are concentrated in *value-different* scenarios where Sacha disagrees with V2.1's expected answer. When the divergence type is *rule-silent*, Claude correctly says so and asks open questions. When the divergence is *value-different*, Claude feels obligated to defend la Feuille's expected value — and when la Feuille is silent on the territory (capot, palier d'ouverture beyond table), Claude invents a defense.

### Do hallucinations correlate with bid value?

| Bid value | Conversations | Hallucinations |
|---|---|---|
| 80 | 1 (conv 14) | 4 |
| 110/120/130/140 | 8 | 2 |
| 150 | 1 (conv 9) | 1 |
| capot | 5 (conv 1, 6, 8, 13, 15) | 4 |

Capot bids and the 80-with-3-As scenario produce 8/9 hallucinations (89 %).

### Do hallucinations correlate with vocabulary?

When Sacha uses V2.1 glossary (pièce, maître, belote), Claude is mostly accurate. When the conversation reaches V2.2 territory (capot, bloquage, contextual ADC), Claude reaches for fabricated structure.

---

## 6. Recommendations for V2.2 system prompt refinement

### 6.1 Hard guards (add immediately)

1. **Capot guard**: Add an explicit guard that Capot is NOT formalized in V2 and Claude must say so rather than invent thresholds. Sample:

   > Capot is not formalized in la Feuille V2. The only documented heuristic is "compter ses perdantes en tenant compte des plis que le partenaire est censé faire". Do NOT invent thresholds (e.g. "X As nécessaires", "domination quasi-totale", "Y points"). If user bids capot, ask about *perdantes* and partner's promised plis — do not assert any rule.

2. **80-opening guard**: Sacha conv 14 was the worst incident. Add explicit:

   > 80 promises **at least 2 As** plus *petit jeu*. Never say "exactly 2 As". A hand with 3+ As can still open 80 if petit jeu is satisfied. If petit jeu fails, the hand passes regardless of As count.

3. **No-baseline-arithmetic guard**: V2.1 is a lookup table, not an additive formula.

   > Do not construct "base + bonus" formulas for V2.1 responses (e.g. "pièce 3ème = 110 de base, +10 pour..."). V2.1 is a lookup. The only additive formula in la Feuille is V2.2 ADC for re-relance: `re-relance = relance_partenaire + (signalable_aces × 10)`, and it applies *after* a partner raise, not on direct response.

4. **Bicolore guard**: state the rule literally.

   > 120 bicolore = maître à l'atout + ≥1 autre atout + cartes réparties dans **strictement 2 couleurs** (atout + 1 autre). Any distribution within those 2 suits is valid (5+3, 6+2, 4+4, 7+1). Do not assert "4+/4+" or any specific split.

5. **Deck-composition guard**: 32 cards, 8 per suit, 8 atouts total per game. Add to system reminders.

### 6.2 Few-shot examples

Add positive few-shot examples for:
- A capot scenario where Claude correctly says "la Feuille ne formalise pas le capot" and asks about perdantes.
- An 80 scenario with 3+ As where Claude correctly says "≥2 As + petit jeu satisfait → 80 valide".
- A pièce-3ème-on-90 scenario where Claude correctly cites the exact V2.1 row (120 = pièce 3ème + 1 As) and says "rule-silent" if no As.

### 6.3 Negative few-shot examples (anti-patterns)

Show Claude what NOT to do, with corrections:
- Anti-pattern: "le capot nécessite 4 As" → corrected to "capot non formalisé, comptons tes perdantes"
- Anti-pattern: "80 promet exactement 2 As" → corrected to "80 promet ≥2 As"
- Anti-pattern: "pièce 3ème = 110 de base" → corrected to "pas de baseline, V2.1 est une table de lookup"

### 6.4 Process suggestions

1. **Don't argue against the user's restatement of la Feuille.** When the user says "X is la règle", the system prompt should require Claude to verify against the doc snippet *before* asserting "C'est une divergence directe avec la Feuille" (conv 14 was a major incident).
2. **For *rule-silent* / *value-different* on capot**, the *only* acceptable answer is "la Feuille ne formalise pas le capot" + open-ended question about perdantes/partance. Never invent.
3. **Few-shot examples are currently helping for rule-silent overcall scenarios (10/10 correct) but actively hurting on value-different scenarios.** Audit the existing few-shots in `claudeService.js` for any that contain capot fabrications, "exactly N As" framings, or 4+/4+ bicolore claims — those will reinforce the patterns above.

### 6.5 Severity rollup

- **High severity, low fix cost**: 80-opening "exactly 2 As" — one prompt edit fixes it.
- **High severity, medium fix cost**: capot fabrications — needs explicit guard + few-shots, and behavioral test.
- **Medium severity, low fix cost**: bicolore "4+/4+", "pièce 3ème = 110 de base" — covered by negative few-shots.
- **Low severity, trivial fix**: deck composition, capot=250 — single line each.

---

## 7. Closing note on the data

Sacha annotated 90 scenarios in the snapshot, of which 15 triggered the V2.2 chat (16 % engagement rate). 4 went deep, 11 were openers Sacha didn't engage. **The 4 deep conversations are extremely valuable** — they capture human bidding reasoning in his native vocabulary — but **3 of the 4 contain hallucinations**, and one (conv 14) features Claude actively misleading Sacha about a rule he had stated correctly.

Sacha's stated feedback — "Claude keeps inventing rules" — is empirically supported: 9 hallucinated factual claims across 5 conversations, with capot and 80-opening as the highest-density buckets. The fixes are concrete and largely prompt-engineering rather than model-level changes.

---

*End of report.*
