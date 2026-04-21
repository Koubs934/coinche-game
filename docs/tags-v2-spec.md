# Training tag vocabulary — v2 (canonical)

`tagsSchemaVersion: 2` • 56 tags across 8 groups (52 v2 + 4 legacy — see note)
Ship date: 2026-04-21 • Source of truth: [`backend/src/training/reasonTags.json`](../backend/src/training/reasonTags.json)

## Background

The v1 vocabulary grouped tags by conclusion type (`hand-claim`, `tactical`,
`partner-signal`, etc.). v2 regroups by **reasoning primitives** — atomic
facts about hand composition, bidding action, and context — so that tag-sets
map cleanly to extractable rules. Each tag in v2 corresponds to a boolean a
bot could evaluate against the hand + bidding state. This is essential for
the eventual rule extraction step: annotations pair tag-sets (features) with
action values (labels), and the rule extractor will cluster annotations by
tag-set to derive bid-selection rules.

---

## Group 1 — Trump hand strength (main d'atout)

| Key | FR | Definition |
|---|---|---|
| `maitre` | Maître à l'atout | Player holds J, 9, and A of trump (all three). |
| `valet-second` | Valet second | J of trump + exactly 1 other trump. Total trump = 2. |
| `valet-troisième` | Valet troisième | J of trump + exactly 2 other trumps. Total trump = 3. |
| `valet-quatrième` | Valet quatrième | J of trump + exactly 3 other trumps. Total trump = 4. |
| `valet-cinquième` | Valet cinquième | J of trump + exactly 4 other trumps. Total trump = 5. |
| `9-second` | 9 second | 9 of trump + 1 other trump, AND no J of trump. Total trump = 2. |
| `9-troisième` | 9 troisième | 9 of trump + 2 other trumps, no J. Total = 3. |
| `9-quatrième` | 9 quatrième | 9 of trump + 3 other trumps, no J. Total = 4. |
| `9-cinquième` | 9 cinquième | 9 of trump + 4 other trumps, no J. Total = 5. |
| `atout-count-2` | 2 atouts | Exactly 2 trump cards total (tagged alongside pattern tags). |
| `atout-count-3` | 3 atouts | Exactly 3 trump cards total. |
| `atout-count-4` | 4 atouts | Exactly 4 trump cards total. |
| `atout-count-5-plus` | 5+ atouts | 5 or more trump cards. |
| `belote-possible` | Belote | K and Q of trump both in hand. |

## Group 2 — Non-trump hand strength

| Key | FR | Definition |
|---|---|---|
| `as-extérieur-0` | 0 As extérieur | Zero Aces in non-trump suits. |
| `as-extérieur-1` | 1 As extérieur | Exactly 1 Ace in non-trump suits. |
| `as-extérieur-2` | 2 As extérieur | Exactly 2 Aces in non-trump suits. |
| `as-extérieur-3` | 3 As extérieur | Exactly 3 Aces in non-trump suits. |
| `deux-as-bare` | 2 As (signal informatif) | 2 non-trump Aces AND no meaningful trump strength (no J, no 9, ≤1 trump total). The 80-informatif pattern. |
| `21` | 21 (As + 10 même couleur) | A and 10 of the same non-trump suit. |
| `deux-21` | Deux 21 | 21 pattern in two different non-trump suits. |
| `longue` | Longue | In a single non-trump suit: A, 10, and K all present. Minimum 3 cards of that suit. |

## Group 3 — Hand shape & liabilities

| Key | FR | Definition |
|---|---|---|
| `bicolore` | Bicolore | Hand concentrated in exactly 2 suits (each of the other 2 suits has 0–1 cards). One of the 2 suits becomes trump if player bids. |
| `fausse-carte-1` | 1 fausse carte | Hand contains exactly 1 non-trump card the player judges will likely lose a trick unpredictably — trick-losing moment can't be controlled or anticipated. Usually an isolated low card in a weak suit. |
| `fausse-carte-2` | 2 fausses cartes | Same criterion, count = 2. |

## Group 4 — Bidding action (exactly one required per decision)

Driven by the `requireExactlyOne: true` flag on the `bidding-action` group in
`reasonTags.json`. The validator rejects submissions with zero or multiple
tags from this group.

| Key | FR | Applies to | Definition |
|---|---|---|---|
| `ouverture` | Ouverture | bid | First bid of the auction (all previous players passed or player is first seat). |
| `monter` | Monter (même couleur) | bid | Raises previous bid, same suit. |
| `changer` | Changer de couleur | bid | Raises previous bid, different suit. |
| `bloquage` | Annonce de blocage | bid | Bid primarily to block opponents from reaching their ideal level. |
| `faire-monter-pour-coincher` | Faire monter pour coincher | bid | Deliberately overbids to provoke opponents into a coinche-able overbid. |
| `cherche-mon-partenaire` | Cherche mon partenaire | bid | Bid whose primary purpose is information signal to partner, not claim. |
| `surenchère-compétitive` | Surenchère compétitive | bid | Genuine raise based on real hand strength, intending to play the contract. |
| `coincher` | Coincher | coinche | Calls coinche on opponent's bid. |
| `surcoincher` | Surcoincher | surcoinche | Calls surcoinche in response to opponent's coinche. |
| `passer-faible` | Passer (main faible) | pass | Passes because hand doesn't justify a bid. |
| `passer-stratégique` | Passer (stratégique) | pass | Passes despite having a biddable hand — tactical pass (letting opponents overreach, letting partner lead, etc.). |

## Group 5 — Partner context

| Key | FR | Definition |
|---|---|---|
| `premier-à-parler` | Premier à parler | Player is first seat, no prior bids. |
| `partenaire-ouverture-80` | Partenaire a ouvert 80 | Partner's first non-pass bid was 80. |
| `partenaire-ouverture-90` | Partenaire a ouvert 90 | Partner's first non-pass bid was 90. |
| `partenaire-ouverture-100` | Partenaire a ouvert 100 | Partner's first non-pass bid was 100. |
| `partenaire-ouverture-110-plus` | Partenaire a ouvert 110+ | Partner's first non-pass bid was 110 or higher. |
| `partenaire-même-couleur` | Partenaire dans ma couleur | Partner's prior bid uses the suit player is considering. |
| `partenaire-autre-couleur` | Partenaire autre couleur | Partner's prior bid uses a different suit from player's consideration. |

## Group 6 — Opponent context

| Key | FR | Definition |
|---|---|---|
| `adverse-a-ouvert` | Adverse a ouvert | An opponent made the first bid of the auction. |
| `adverse-a-surenchéri` | Adverse a surenchéri | An opponent raised a previous bid. |

## Group 7 — Score context

| Key | FR | Definition |
|---|---|---|
| `score-équilibré` | Score équilibré | Teams within ~100 pts of each other, game not near threshold. |
| `score-derrière` | Derrière, besoin de points | Player's team is behind; conservative play won't catch up; justifies stretching. |
| `score-avance` | En avance, sécurisation | Player's team is ahead; favor safer contracts. |
| `dernière-donne` | Dernière donne du match | Final hand of match; bid tuned to exact points needed. |

## Group 8 — Uncertainty / meta

| Key | FR | Definition |
|---|---|---|
| `jugement` | Jugement | Decision was judgment-based, can't fully articulate in tags/rules. |
| `incertain` | Incertain | Player unsure decision was correct. Review after hand plays out. |
| `autre` | Autre (note requise) | None of the above tags capture the reasoning. Requires non-empty note. Acts as gap-detection. Also used for coinche/surcoinche reasoning until a sub-vocabulary is designed. |

---

## Validator rules

Driven declaratively by flags in `reasonTags.json` — no hardcoded keys in
[`tagValidator.js`](../backend/src/training/tagValidator.js):

| Flag | Where | Effect |
|---|---|---|
| `requireExactlyOne: true` | `groups.<group-key>` | For every action whose tag list contains tags in this group, exactly one tag from the group must be selected. Zero → `GROUP-REQUIRED-MISSING`. Multiple → `GROUP-REQUIRED-MULTIPLE`. |
| `recommendAtLeastOne: true` | `groups.<group-key>` | Same action-scoping rule but emits a non-blocking warning (`result.warnings`) when zero tags are selected. The client surfaces this via a confirmation overlay; the user may Continuer (resubmit with `ackWarnings: true`) or Revenir et ajouter (dismiss and edit). |
| `requiresNote: true` | `actions.<action>.tags[*]` | If any selected tag carries this flag, `note.trim()` must be non-empty. Rejection code `TAG-REQUIRES-NOTE`. |

Group flags currently set:
- `bidding-action` → `requireExactlyOne`
- `trump-hand` → `recommendAtLeastOne`

Tags currently flagged `requiresNote: true`:
- `autre` (v2 meta)
- `other` (v1 play-card — preserved contract)

## Migration from v1

v1 tag file is archived at [`backend/src/training/reasonTags.v1.json`](../backend/src/training/reasonTags.v1.json)
and is **not** loaded by any runtime code — it exists solely as a historical
reference for reading old annotation records (anything written with
`tagsSchemaVersion: 1`).

The 8 production annotations captured under v1 were re-tagged under v2 on
2026-04-21; the retag draft + per-annotation justification lives under
`backend/data/training/_retag-v2-draft-output/RETAG-REPORT.md` (gitignored
while in review, applied to the persistent volume after sign-off).

play-card remains on the v1 tag set in `reasonTags.json` for now — no
play-card scenarios exist yet and the v2 spec doesn't cover them. A
dedicated play-card v2 pass is expected when the first play-card scenarios
ship. Until then the validator short-circuits the Group-4 rule for
`play-card` because the action's tag list has no `bidding-action` tags.
