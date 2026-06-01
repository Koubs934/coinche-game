# Rod (Rod_le_thug) — annotation snapshot

Pulled: 2026-05-06 from production volume (`/data/training/112e7b0d-bbfd-4db3-a6be-d79d96777df3/`).
Source mirror: `backend/data/training/_rod-snapshot/` (gitignored).
Companion analysis JSON: `backend/data/training/_rod-snapshot/_analysis.json`.

## 1. Summary stats

| Metric | Value |
|---|---|
| Total annotations | 73 |
| Distinct scenarios | 71 (two scenarios re-played across sessions) |
| First annotation | 2026-04-21T18:24:26Z |
| Last annotation  | 2026-05-06T21:41:54Z |
| Active sessions  | 4 (Apr 21, May 5×2, May 6) |
| Schema versions  | v2: 5, v3: 4, v4: 64 |
| V2.2 conversational data | **none** — `claude_conversation` field absent in all 73 |

### Sessions (≥30 min gap = new session)

| # | Start | End | Duration | Annotations |
|---|---|---|---|---|
| 1 | 2026-04-21 18:24Z | 2026-04-21 18:31Z |  7 min |  5 |
| 2 | 2026-05-05 14:15Z | 2026-05-05 14:16Z |  1 min |  3 |
| 3 | 2026-05-05 22:32Z | 2026-05-05 22:32Z |  0 min |  1 |
| 4 | 2026-05-06 21:19Z | 2026-05-06 21:41Z | **22 min** | **64** |

The May 6 session is the headline event: 64 annotations in 22 minutes → ~21 sec / decision. This is consistent with Rod sweeping through the entire current scenario backlog.

### Divergence type breakdown

| Type | Count | % |
|---|---|---|
| match | 26 | 36% |
| value-different | 9 | 12% |
| suit-different | 0 | 0% |
| action-type-different | 3 | 4% |
| rule-silent | 35 | 48% |

### Agreement breakdown (when divergent — 47 cases)

| Agreement | Count | % of divergent |
|---|---|---|
| could-be-either | 0 | 0% |
| **user-disagrees** | **42** | **89%** |
| null (older schema, no field) | 5 | 11% |

This is the biggest contrast vs Sacha (who said "Pas d'accord" on 6% of divergent calls). Rod actively pushes back on almost every case where La Feuille has an answer he doesn't like, *and* on most rule-silent prompts the FE collected agreement on.

### Scenario category breakdown

| Category | Count | Notes |
|---|---|---|
| `opening` | 17 | Full sweep of the new 15 + duplicates |
| `partner-opened-opp-overcalled` | 18 | Rod sat through the entire batch — 15 competitive variants + 3 named |
| `second-opp-opened` | 6 |  |
| `fourth-position` | 5 |  |
| `response-80/90/100/110/120` | 15 | 3 each |
| `petit-jeu` | 4 | 2 distinct, each played twice |
| `validation` | 5 | Of which one (`validation-scenario-15`) was the only validation-set divergence |
| `block` | 1 | Apr 21 schema-v2 file |
| `raise` | 2 | `raise-partner-90-hearts` played twice |

## 2. Match table — Rod aligned with La Feuille V2.1

26 scenarios where Rod's action exactly matched the rule's expected answer. Most are the silent-submit path (no note, no reasoning UI shown).

| # | Scenario | Action |
|---|---|---|
| 1 | `fourth-position-03-all-passed-3` | pass |
| 2 | `opening-02-piece-4th-no-outside-ace` | pass |
| 3 | `opening-03-borderline-80-vs-90-piece-3rd-belote` | 80 ♠ |
| 4 | `opening-06-no-piece-4-trumps-belote` | 80 ♣ |
| 5 | `opening-07-no-piece-5-trumps` | 80 ♦ |
| 6 | `opening-08-one-ace-piece-3rd-belote` | 90 ♠ |
| 7 | `opening-09-one-ace-J-9-1-other` | 90 ♥ |
| 8 | `opening-12-maitre-110-ace-in-singleton` | 110 ♦ |
| 9 | `opening-14-piece-4th-second-pattern-9-fourth` | 90 ♣ |
| 10 | `opening-petit-jeu-first-to-speak` (Apr 21 take) | pass |
| 11 | `petit-jeu-after-partner-80-spades` (Apr 21 take) | 130 ♠ |
| 12 | `raise-partner-90-hearts` (Apr 21 take) | 110 ♥ |
| 13 | `raise-partner-90-hearts` (May 6 take) | 110 ♥ |
| 14 | `response-100-01-one-outside-ace` | 110 ♠ |
| 15 | `response-100-02-two-outside-aces` | 120 ♠ |
| 16 | `response-110-01-one-extra-ace` | 120 ♠ |
| 17 | `response-110-02-two-extra-aces` | 130 ♠ |
| 18 | `response-120-03-two-aces-no-piece-pass` | pass |
| 19 | `response-80-01-piece-3rd-no-aces` | 120 ♠ |
| 20 | `response-80-02-piece-2nd-2-aces` | 110 ♠ |
| 21 | `response-90-01-piece-2nd-1-ace` | 110 ♠ |
| 22 | `response-90-03-one-ace-no-piece-pass` | 100 ♠ |
| 23 | `validation-scenario-17` | 110 ♠ |
| 24 | `validation-scenario-18` | 80 ♠ |
| 25 | `validation-scenario-19` | 90 ♠ |
| 26 | `validation-scenario-20` | 80 ♥ |

**Notable**: Rod played `petit-jeu-after-partner-80-spades`, `opening-petit-jeu-first-to-speak`, and `raise-partner-90-hearts` in **both** the Apr 21 session and the May 6 session. He kept his answer on `raise-partner-90-hearts` (110 ♥ both times) but flipped on the other two — see §3 below.

## 3. Hard divergence drill-down — formalized scenarios where Rod said "Pas d'accord"

12 scenarios where La Feuille V2.1 has a non-null `expectedAnswer` but Rod picked a different action **and** explicitly disagreed. These are the strongest signals for La Feuille revision.

### `validation-scenario-15` — 🔴 **Pas d'accord** (delta +40)

- **Expected (La Feuille)**: 120 ♠ — `opening:120-bicolore`
- **Rod's action**: 160 ♠
- **Divergence type**: `value-different`
- **Note**:

> J'ai tous les plis maîtres sauf potentiellement 1 (le 7 de cœur). J'ai en plus la belote

### `opening-04-maitre-bicolore-7-1-side` — 🔴 **Pas d'accord** (jumps to capot)

- **Expected (La Feuille)**: 120 ♠ — `opening:120-bicolore`
- **Rod's action**: capot ♠
- **Divergence type**: `value-different`
- **Note**:

> J'ai aucun faux plis j'annonce capot

### `opening-05-maitre-bicolore-6-2-side` — 🔴 **Pas d'accord** (delta +20)

- **Expected (La Feuille)**: 120 ♥ — `opening:120-bicolore`
- **Rod's action**: 140 ♥
- **Divergence type**: `value-different`
- **Note**:

> Je n'ai qu'un seul faux pli j'ai la belote. Je préfère annoncer gros pour bloquer les annonces des adversaires

### `opening-01-maitre-and-3-outside-aces` — 🔴 **Pas d'accord** (delta +10)

- **Expected (La Feuille)**: 110 ♠ — `opening:110:maitre+1as_ext`
- **Rod's action**: 120 ♠
- **Divergence type**: `value-different`
- **Note**:

> Là j'ai juste deux faux plis donc j'annonce 120

### `fourth-position-04-all-passed-4` — 🔴 **Pas d'accord** (delta −10)

- **Expected (La Feuille)**: 100 ♥ — `opening:100:maitre`
- **Rod's action**: 90 ♥
- **Divergence type**: `value-different`
- **Note**:

> Je ne suis pas maître à l'atout. Je suis dominé s'il y a un 10 avec 3 autres atouts. Donc 90 cœur car 1 as (même si couleur de l'atout) avec un jeu à cœur

### `opening-11-maitre-outside-J-no-bicolore` — 🔴 **Pas d'accord** (delta −10)

- **Expected (La Feuille)**: 100 ♥ — `opening:100:maitre`
- **Rod's action**: 90 ♥
- **Divergence type**: `value-different`
- **Note**:

> Je ne suis pas maître à l'atout car il y a le 10 quatrième potentiel à cœur

### `opening-15-maitre-with-side-piece-not-exploitable` — 🔴 **Pas d'accord** (delta −10)

- **Expected (La Feuille)**: 100 ♠ — `opening:100:maitre`
- **Rod's action**: 90 ♠
- **Divergence type**: `value-different`
- **Note**:

> Je ne suis pas maître à l'atout. Il y a le 10 quatrième à pique qui peut me dominer

### `petit-jeu-after-partner-80-spades` (May 6 take) — 🔴 **Pas d'accord** (delta −10)

- **Expected (La Feuille)**: 130 ♠ — `response-to-80:130:piece-3rd+1as`
- **Rod's action**: 120 ♠
- **Divergence type**: `value-different`
- **Note**:

> Pour moi les deux annonces sont ok. Mais je parle à 120 car je ne compte que deux fausses cartes avec ses deux as

(*On Apr 21 he said 130 with no pas-d'accord. The May 6 retake is more conservative.*)

### `opening-10-two-aces-no-petit-jeu` — 🔴 **Pas d'accord** (passes where rule bids)

- **Expected (La Feuille)**: 80 ♦ — `opening:80:two-aces+petit-jeu`
- **Rod's action**: pass
- **Divergence type**: `action-type-different`
- **Note**:

> Je peux vite être dominé à l'atout si j'annonce à cœur je préfère ne pas parler

### `opening-13-three-aces-no-piece` — 🔴 **Pas d'accord** (bids where rule passes)

- **Expected (La Feuille)**: pass — `opening:80-needs-exactly-2-aces`
- **Rod's action**: 80 ♠
- **Divergence type**: `action-type-different`
- **Note**:

> Je peux essayer de dire à mon partenaire que j'ai deux as pour essayer de le trouver. Mais c'est risqué on peut aussi passer

### `opening-petit-jeu-first-to-speak` (May 6 take) — 🔴 **Pas d'accord** (bids where rule passes)

- **Expected (La Feuille)**: pass — `opening:pass-no-pattern-qualifies`
- **Rod's action**: 90 ♠
- **Divergence type**: `action-type-different`
- **Note**:

> Les deux choix sont valides je trouve

(*Reversal vs his Apr 21 pass on the same scenario.*)

### `response-120-01-three-aces` — 🔴 **Pas d'accord** (full action redirect)

- **Expected (La Feuille)**: 130 ♠ — `response-to-120:130:three-aces-or-piece`
- **Rod's action**: capot ♣ (different value AND different suit)
- **Divergence type**: `value-different`
- **Note**:

> Oui 130 j'ai trois as donc je monte à 130

(*Note self-contradicts the action — note says "130" but the recorded action is `capot ♣`. Possible UI slip.*)

## 4. Rule-silent annotations — Rod's notes as evidence for rule extension

35 scenarios where La Feuille is silent. 30 of these have a note ≥ 30 chars (high-signal). Grouped by category.

### Category: `partner-opened-opp-overcalled` (16 of 18 are rule-silent)

Rod sat through the entire competitive batch. His reasoning template is consistent enough that this category alone could anchor a V2.2 "competitive response" sub-rule.

#### `partner-opened-opp-overcalled-01-partner-80s-opp-90h`

- **Action**: 130 ♠
- **Note**:

> J'ai la pièce (valet ou neuf) avec au moins deux autres cartes à pique. J'annonce 120. Comme j'ai un as en plus j'annonce 130

#### `partner-opened-opp-overcalled-02-partner-100s-opp-110h`

- **Action**: pass
- **Note**:

> Mon partenaire est maître à l'atout. Il cherche donc des as. Je n'en ai pas donc je ne monte pas

#### `partner-opened-opp-overcalled-03-partner-90h-opp-100s`

- **Action**: 120 ♥
- **Note**:

> Mon partenaire parle à 90 cœur. J'ai la pièce troisième (avec deux autres cœur) je monte à 120

#### `partner-opened-opp-overcalled-04-partner-80h-opp-coinche-territory`

- **Action**: pass
- **Note**:

> Je n'ai pas le jeu pour miser

#### `partner-opened-opp-overcalled-05-partner-110s-opp-120h`

- **Action**: 130 ♠
- **Note**:

> J'ai 4 atouts. Une coupe mon partenaire est maître à l'atout et à 1 as. J'ai la belote je peux enchérir. Sans la belote je n'aurais pas enchéri

#### `partner-opened-opp-overcalled-06-partner-90s-opp-90h`

- **Action**: 120 ♠
- **Note**:

> Mon partenaire parle à 90 pique. J'ai la pièce troisième je monte à 120

#### `partner-opened-opp-overcalled-07-partner-100h-opp-110s` *(annotated twice — May 5 and May 6)*

- **May 5 action**: 120 ♥. Note:

> Mon partenaire annonce 100 cœur. Il est maître à l'atout il cherche donc les as. J'ai un atout et deux as je peux monter de +20

- **May 6 action**: 120 ♥. Note:

> Mon partenaire parle à 100 cœur il est donc maître à l'atout et cherche des as. J'ai de l'atout et deux as je monte de +10 par as

#### `partner-opened-opp-overcalled-08-competitive-8`

- **Action**: 130 ♠
- **Note**:

> Mon partenaire parle à 80 il a donc deux as. J'ai un très bon jeu à pique et un as extérieur en plus

#### `partner-opened-opp-overcalled-09 / -10 / -11 / -12` (all variants of partner 80♠ + opp 90♥)

All four resolve to 120 ♠ with very similar notes:

> Mon partenaire parle à 80 pique il a donc deux as. J'ai au moins la pièce troisième à pique je parle à 120

#### `partner-opened-opp-overcalled-13 / -14 / -15` (same scenario family + 1 As ext)

All three resolve to 130 ♠:

> Mon partenaire parle à 80 pique il a donc deux as. J'ai au moins la pièce troisième à pique je parle à 120
> Comme j'ai un as en plus j'annonce 130

### Category: `second-opp-opened` (6 rule-silent)

Mostly short notes. The two coinches stand out:

#### `second-opp-opened-04-opp-80c-user-coinche-territory`

- **Action**: **coinche**
- **Note**:

> Je ne pense pas qu'il va faire 80 points . J'ai le neuf second à l'atout. J'ai trois as

#### `second-opp-opened-05-opp-80h-user-same-suit-strong`

- **Action**: **coinche**
- **Note**:

> Je le domine complètement à l'atout

#### `second-opp-opened-01-opp-80h-user-strong-other`

- **Action**: 120 ♠. Note:

> Je compte deux fausses cartes s'il n'y a pas le 10 quatrième à l'atout donc je parle à 120

#### `second-opp-opened-02-opp-80s-user-petit-jeu-clubs`

- **Action**: 90 ♣. Note:

> J'ai un petit jeu à trèfle et un as extérieur

(*Smaller notes on `-03` and `-12` — both passes, "Je n'ai pas un jeu pour parler" / "Je n'ai rien pour parler".*)

### Category: `response-X-silent` (4 silent passes)

| Scenario | Action | Note |
|---|---|---|
| `response-100-03-no-outside-ace-silent` | pass | "Je n'ai rien à lui annoncer pas dans pas de pique pas de carte maitre" |
| `response-110-03-no-extra-ace-silent` | pass | "Je n'ai rien à lui annoncer" |
| `response-120-02-piece-of-trump` | pass | "Mon partenaire est à 120 mais pour monter à 130 il faut trois as" |
| `response-80-03-no-piece-no-aces-pass` | pass | "Je n'ai pas un jeu pour le changer" |

(*`response-120-02-piece-of-trump` is the most interesting: the V2.1 expected answer is 130 (pièce d'atout path), but Rod read the rule as "130 needs three Aces". This points at a real ambiguity in the response-to-120 rule wording — same place Sacha also passed.*)

### Category: `response-90-02-three-aces-self-contradicts`

- **Action**: 110 ♠. Note:

> Il parle à 90 pique j'ai deux as je lui annonce

(*Scenario is flagged "self-contradictory" — partner can't have all three Aces if user has two of them. Rod resolves by treating his hand as a 110-style support response.*)

### Category: `petit-jeu-after-opp-80-spades` (annotated twice)

- **Apr 21 action**: pass. Note: "Main trop faible. En plus je sais que mon adversaire a deux as"
- **May 6 action**: 120 ♠. Note: "Je compte deux fausses cartes avec ses deux as donc je met 120"

(*Direct reversal between sessions — worth flagging for the rule author. Probably the May 6 take corresponds to a slightly different hand on the alternativeIndex 0 vs Apr 21.*)

### Category: `fourth-position-05/06/07-opp-left-opened` (3 rule-silent passes)

All three resolve to pass with short notes ("Je n'ai pas un jeu pour miser/suivre"). Useful as floor evidence that on these hand archetypes the consensus is "pass".

### Category: `block-120-after-opp-overcall` (Apr 21, schema v2)

- **Action**: 110 ♦
- **Note**: Three lines reasoning about partner having two outside Aces from his 80♠ opening, and Rod holding the three best trumps.

## 5. V2.2 Conversational analysis

**No conversational data in this snapshot.** None of the 73 annotation files contain a `claude_conversation` field, and no `card_selections` payloads were saved. Rod's session pattern (~21 sec/decision in the May 6 burst) is consistent with the silent-submit / pas-d'accord path only — he did not engage the V2.2 chat surface in any of these annotations.

Implication: Rod's free-text notes are the only narrative signal. The card-selection feature (Phase 2C) and Claude-chat dialog (Phase 2A/2B) have no Rod data to calibrate against — only Sacha-style note text.

## 6. Patterns and observations

### 6.1 Action distribution

| Action | Count |
|---|---|
| pass | 17 |
| coinche | 2 |
| surcoinche | 0 |
| bid 80 | 6 |
| bid 90 | 9 |
| bid 100 | 1 |
| bid 110 | 9 |
| bid 120 | 17 |
| bid 130 | 8 |
| bid 140 | 1 |
| bid 160 | 1 |
| bid capot | 2 |

### 6.2 Trump suit choice (bids only, n=54)

| Suit | Count |
|---|---|
| ♠ S | 37 |
| ♥ H | 10 |
| ♣ C | 4 |
| ♦ D | 3 |

(Spades dominate because the May 6 batch's `partner-opened-opp-overcalled-08…15` family is structured around partner opening 80♠.)

### 6.3 Direction of divergence (formalized scenarios only)

| Direction | Count |
|---|---|
| Bid higher than expected (by +10) | 1 |
| Bid higher than expected (by +20) | 1 |
| Bid higher than expected (by +40) | 1 |
| Bid higher than expected (jumps to capot) | 1 |
| Bid lower than expected (by −10) | 4 |
| Same value, different suit | 0 |
| Bid where rules said pass | 2 |
| Passed where rules said bid | 1 |
| Different value AND different suit (1 case) | 1 (`response-120-01-three-aces`: Rod capot ♣, expected 130 ♠) |

The −10 cluster is the most coherent: 4 of his 4 "bid lower" cases are all about the maître-but-10-fourth-out-there problem, where he refuses to call himself maître and steps down from 100 to 90.

### 6.4 Note length

| Metric | Value |
|---|---|
| Annotations with non-empty note | 50 of 73 (68.5%) |
| Median note length (chars) | 88 |
| Mean note length (chars)   | 85 |
| Longest note (chars) | 177 |

Rod writes longer notes than Sacha (median 88 vs 48). When he annotates, he writes a full sentence of reasoning.

### 6.5 Vocabulary fingerprint

| Term | Mentions |
|---|---|
| "pièce" / "piece" | 11 |
| "maître" / "maitre" | 9 |
| "belote" / "rebelote" | 4 |
| "as ext" / "as extérieur" | 3 |
| "perdant" / "faux pli" / "fausses cartes" | 3 (mostly "fausses cartes" or "faux pli") |
| "longue" | 1 |
| "points" | 1 |
| **"chiquer"** | **0** |

Rod **never uses "chiquer"** in his notes — that's the V2.2 author's term, not part of his vocabulary. Closest equivalent he uses: "annoncer gros pour bloquer". This matters because the chiquer rename / formalisation is being calibrated against the assumption players think of it as a named concept; Rod evidently doesn't.

He also says **"fausses cartes"** rather than "perdantes" — same notion (false cards / losers), different label.

### 6.6 Coinche usage

Rod coinched 2 times in 73 annotations (2.7%). Both are rule-silent `second-opp-opened` scenarios where he sees either a self-contradicting opp 80 (`opp-80c-user-coinche-territory`: opp bids 80♣ but Rod has 9♣ second + 3 aces) or full domination of the opp's chosen trump (`opp-80h-user-same-suit-strong`).

### 6.7 Rod's recurring reasoning templates

Three templates appear over and over. They're worth promoting verbatim into V2.2 because they're internally consistent and applied with discipline:

**Template A — partner 80 in a suit, opp overcalls:**
> Mon partenaire parle à 80 [X] il a donc deux as.
> J'ai au moins la pièce troisième à [X] je parle à 120.
> [Si j'ai un as en plus] j'annonce 130.

**Template B — partner 100 maître:**
> Mon partenaire parle à 100. Il est maître à l'atout, il cherche les as.
> +10 par as que j'ai.

**Template C — "not maître":**
> Je ne suis pas maître à l'atout car il y a le 10 quatrième potentiel.
> Donc je redescends de 100 à 90.

### 6.8 Consistency across re-plays

Rod replayed three scenarios across sessions:

| Scenario | Apr 21 | May 6 | Same? |
|---|---|---|---|
| `raise-partner-90-hearts` | 110 ♥ | 110 ♥ | ✅ |
| `petit-jeu-after-partner-80-spades` | 130 ♠ | 120 ♠ (pas d'accord) | ❌ — became more conservative |
| `opening-petit-jeu-first-to-speak` | pass | 90 ♠ (pas d'accord) | ❌ — became more aggressive |
| `petit-jeu-after-opp-80-spades` | pass | 120 ♠ (pas d'accord) | ❌ — flipped completely |

Three of four re-plays diverge between sessions. Rod's calibration is not stable across time — relevant for the training tool (we should expect drift, and the tool should probably surface "you answered differently last time" when this happens).

## 7. Comparison to Sacha (where data permits)

| Metric | Sacha (2026-05-04) | Rod (2026-05-06) |
|---|---|---|
| Annotations | 35 | 73 |
| Sessions | 1 (28 min) | 4 (Apr 21, May 5×2, May 6 — May 6 burst is 22 min / 64 ann) |
| Match rate | 29% | 36% |
| Hard divergence ("Pas d'accord") | 6% (2/35) | **57% (42/73)** |
| Rule-silent | 66% | 48% |
| Median note length | 48 | 88 |
| Coinche actions | 1 | 2 |
| Uses "chiquer"? | no | no |
| Uses "perdantes"? | no — "perdantes" 0 mentions | no — uses "fausses cartes" / "faux pli" |
| `opening-*` annotations | 0 | 17 (full set) |
| `partner-opened-opp-overcalled-*` | 5 | 18 (full set) |
| `second-opp-opened-*` | 12 | 6 |

**Same scenario, different read:** `raise-partner-90-hearts` is the cleanest A/B between them. Sacha said 130 ♥ ("La pièce second sur ouverture 90 120 + 1 as 130") and disagreed with the V2.1 rule of 110. Rod said 110 ♥ and matched the rule — twice. This is consistent with Sacha applying a +10/Ace overlay whereas Rod applies the V2.1 table directly.

**Pas d'accord intensity gap:** Sacha disagrees rarely and quietly — Rod disagrees on >half of all his decisions, including most rule-silent prompts. This is a real behavioural difference (and a non-trivial calibration question for the training tool: is the rate of "Pas d'accord" itself a signal we should weight, or noise?).

**Coverage gap:** Rod swept categories Sacha hadn't touched (the `opening-*` batch, the full `partner-opened-opp-overcalled-*` batch). He is the primary source of evidence on those scenarios today.

## 8. Suggestions for La Feuille / training tool

(*These are observations from the data, not commitments. Decisions for Aaron.*)

1. **Maître + 10-fourth risk**: Rod consistently disagrees with V2.1's "maître → 100" when a 10-fourth in opp's hand would dominate. He drops to 90. If multiple annotators repeat this, formalise "maître requires top-2 in trump" or carve out a "near-maître → 90" tier.
2. **Bicolore upper bound**: V2.1 caps bicolore at 120, but Rod jumps to 140 / 160 / capot on strong bicolores with belote. The "annoncer gros pour bloquer" justification is recurrent enough that the cap probably needs a +20 rider when belote is held.
3. **Competitive response after partner opened + opp overcalled**: 18 of Rod's 73 are this scenario family. Rule is silent; his Templates A and B above are tight enough to draft a sub-rule from.
4. **`response-120-02-piece-of-trump` ambiguity**: Both Rod and Sacha pass here. The "130 with pièce" branch of V2.1 may be unclear in the wording — worth re-reading the published rule.
5. **Self-contradicting scenarios** (`response-90-02-three-aces-self-contradicts`, `opening-13-three-aces-no-piece`): The training tool currently treats these inconsistently — sometimes flagged as `*-self-contradicts` ambiguity, sometimes not. Rod's responses suggest a unified "if hand contradicts the rule premise, follow the hand" heuristic.
6. **Re-play drift**: 3 of 4 of Rod's re-plays diverged. The tool should probably surface "you answered X last time" when an annotator hits the same scenario again, both as a calibration prompt and as drift evidence.
7. **No conversational engagement**: Rod did 64 annotations in 22 min — he never used the V2.2 chat. Either chat is opt-in and he didn't opt in, or the silent-submit / pas-d'accord path is fast enough that he's never tempted. Worth checking which.
