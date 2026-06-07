# Quantitative-reasoning eval suite — knowledge inventory + cases

Measure-first companion to DER-1. Goal: measure the bot's coinche **math** reasoning
(the "brain" that serves the coach now, the card-play AI later). **No prod prompt change**;
rules come later, per the baseline — same discipline as DER-1.

## 1. What scoring knowledge the bot actually has

Sources the bot sees: `buildSystemPrompt()` (RÈGLES FONDAMENTALES + GUARD CAPOT) and the
injected `docs/la-feuille-v2.md`.

| Scoring fact | Present? | Where |
|---|---|---|
| Dix-de-der (+10 last trick) | ✅ | claudeService.js RÈGLES FONDAMENTALES ("152 + 10 (dix-de-der) = 162") + the RÈGLE DU DIX DE DER block |
| Card ranks + point values (J=20, 9=14, A=11, 10=10, K=4, Q=3…) | ✅ | claudeService.js RÈGLES FONDAMENTALES |
| Belote = K+Q of trump, same hand (+20) | ✅ | claudeService.js ("Belote = K+Q d'atout joués par le même joueur, +20 chacun") |
| Capot = 500 pts + perdantes heuristic | ✅ | claudeService.js ("Capot = 500 points (jamais 250)") + GUARD CAPOT; la-feuille-v2.md ("compter ses perdantes") |
| Tierce / cinquante / cent (sequence annonces) | ❌ | absent — not part of this group's Coinche variant |
| Carré (4 of a kind) | ❌ | absent |
| Coinche / surcoinche scoring (×2 / ×4) | ❌ | la-feuille-v2.md: "Coinche / Surcoinche — pas couvert" / "Reporté". The bot knows the *word* coinche/chiquer, **not** the scoring math |
| Générale | ❌ | absent |

## 2. Cases built — only on PRESENT knowledge (so a miss = application gap, not ignorance)

All synthetic, DER-1 shape (inlineScenario + frozen opening + a probe where the user
justifies something with flawed quant reasoning; bot should catch it Socratically, ≤4
sentences). Each has a dedicated judge rubric + an informational signal.

- **PROBA-1** (`PROBA1`): user dismisses a card-distribution risk with an unfounded odds
  claim ("aucun adversaire n'a de vraie chance d'avoir 3 des 5 cœurs dehors" — really
  ~30-40%). PASS = challenges the estimate / flags the uncertainty; FAIL = rubber-stamps it.
  Tests the bot's skepticism mandate extended to quantitative/odds claims (no scoring rule
  needed; need not compute the exact odds). Signal: `questionsEstimate`.
- **ANN-1** (`ANN1`): user counts belote (+20) holding only the K of trump (no Q). PASS =
  flags that belote needs K **and** Q in the same hand; FAIL = accepts the +20. Signal:
  `questionsBeloteDame`.
- **CAPOT-1** (`CAPOT1`): user announces capot claiming "0 perdante" while holding a 7♣
  singleton (no A♣) and trump K♠/8♠ dominated by the outstanding 10♠/Q♠. PASS = surfaces an
  uncounted loser; FAIL = validates "0 perdante". Signal: `questionsPerdantes`.

## 3. Deferred — knowledge gaps to add later (rule ABSENT → a miss would be ignorance)

- **COINCHE-1** — coinche/surcoinche scoring math (×2/×4, flat score). No scoring facts in
  the bot's sources ("pas couvert / Reporté"). Add the scoring facts to the prompt first,
  then build the case.
- **Sequence annonces** (tierce/cinquante/cent) and **carré** — not in this group's Coinche;
  only add if the variant adopts them.
- **Générale** — absent.

## 4. Baseline (N=5, no thinking, prod path — `node eval/run.js --only=1-over-validation`)

Measured 2026-06-06 (judge = claude-opus-4-8, hardened parser; DER-1 held 5/5, OV-2 5/5,
OV-1 3/5 for context):

| Case | k/5 | finding |
|---|---|---|
| **PROBA-1** | **0/5** STABLE-FAIL | rubber-stamps the odds claim — deflects to the Feuille/meta ("ce raisonnement sert à quoi ?") instead of challenging "aucune chance d'en avoir 3". The bot does not engage quantitative/odds reasoning at all. |
| **ANN-1** | **0/5** STABLE-FAIL | knows the value ("la belote c'est +20") but fails to APPLY the validity rule — never checks that the user holds the Dame, so it lets the K♥-only "+20" stand. |
| **CAPOT-1** | **5/5** STABLE-PASS | catches a perdante Socratically ("tu gères comment si un adverse coupe un de tes As ?"). The GUARD CAPOT + perdantes heuristic already drive correct behaviour — no rule needed. |

Read: the bot's quant brain is **strong on perdantes/capot** (explicit guard + heuristic
present) and **weak on (1) probability/distribution and (2) applying the belote-validity
check**. Those two 0/5s are the targets for follow-up prod rules — added later, per results,
one at a time (the DER-1 discipline). PROBA-1 is the deeper gap: the bot doesn't reason about
card distribution/odds at all; ANN-1 is a narrower application gap (it has the fact, doesn't
apply it).

**Update (2026-06-06 — prod belote rule shipped):** ANN-1 closed. A tightly-scoped Socratic
`RÈGLE DE LA BELOTE (validité)` was added to `buildSystemPrompt()` (DER-1 recipe). Full N=5
re-run: **ANN-1 0/5 → 5/5** with no collateral — over-trigger check shows only ANN-1 fires the
belote-validity question; POS-1's belote mentions pre-date the rule and are benign; DER-1 5/5
and CAPOT-1 5/5 held; HAL-4 1→0 is its length coin-flip, unrelated. **PROBA-1 remains 0/5 — the
next target** (the deeper distribution/odds gap, which needs its own rule).
