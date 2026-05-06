# Dataset snapshot — 2026-04-21

Source: Railway production volume `/data/training/`, pulled via `railway ssh` → `tar czf` → `base64` → local extract.
Snapshot stored at `backend/data/training/_snapshot-source-2026-04-21/` (gitignored via `backend/data/`).

This report presents what's in the dataset as of the pull. No judgments, no recommendations — just counts and verbatim quotes.

---

## 1. Summary stats

| Metric | Value |
|---|---|
| Total users | 3 |
| Total annotation files | 18 |
| Total decisions | 18 (one decision per file) |
| Date range (earliest → latest `completedAt`) | 2026-04-21T05:02:55Z → 2026-04-21T18:32:21Z (a single calendar day) |
| Schema version 1 (legacy, no sessionId) | 2 annotations |
| Schema version 2 (session-aware) | 16 annotations |
| `tagsSchemaVersion` | 2 on all annotations |
| `scenarioSchemaVersion` | 1 on all annotations |
| Scenarios touched | 5 of 5 |
| `_exhausted.json` sidecar files | 3 (one per user) |

### Per-user

| userId | username | annotations | exhausted scenarios marked | notes |
|---|---|---|---|---|
| `7f35ed6a-8e9a-421e-8e79-1086fa663478` | AK7 | 7 | 4 | 2 schema-v1 annotations at 05:01–05:04 (pre-session-model); remainder v2 at 06:59–07:09. Ran one multi-alternative session (pass + coinche on petit-jeu-after-opp-80-spades, session `58a49f2e…`, alternativesRecorded = 2). |
| `3a18141b-7ed2-4221-9891-13518e352ed2` | Jejemoumou06 | 6 | 5 | Ran `opening-petit-jeu-first-to-speak` twice in separate sessions (18:20 and 18:25) — both `alternativeIndex: 0` of different `sessionId`s, both same action. Only the later session is in `_exhausted.json`. |
| `112e7b0d-bbfd-4db3-a6be-d79d96777df3` | Rod_le_thug | 5 | 5 | All v2, all within 18:24–18:32 window. One session per scenario. |

---

## 2. Per-scenario breakdown

### 2.1 `block-120-after-opp-overcall`

- Total annotations: 3 (one per user)
- Exhausted by: all 3 users
- Action distribution:
  | Action | Count | Who |
  |---|---|---|
  | `bid 110 D` | 2 | Rod_le_thug, Jejemoumou06 |
  | `bid 120 D` | 1 | AK7 |
- **Divergent on value** (same trump ♦, different levels).

### 2.2 `opening-petit-jeu-first-to-speak`

- Total annotations: 4 (AK7 × 1, Jejemoumou06 × 2, Rod_le_thug × 1)
- Exhausted by: all 3 users
- Action distribution:
  | Action | Count | Who |
  |---|---|---|
  | `pass` | 3 | Rod_le_thug × 1, Jejemoumou06 × 2 (two separate sessions, same answer) |
  | `bid 90 S` | 1 | AK7 |
- **Divergent on action** (pass vs bid). The two users who saw the exhaustion dialog after passing (Rod, Jeje) never supplied an alternative — both arrived at pass as their only answer. AK7 (the one bidder) also never entered an alternative.

### 2.3 `petit-jeu-after-opp-80-spades`

- Total annotations: 4 (one per user + AK7's second alternative)
- Exhausted by: all 3 users (AK7 with `alternativesRecorded: 2`)
- Action distribution:
  | Action | Count | Who |
  |---|---|---|
  | `pass` | 3 | Rod_le_thug, Jejemoumou06, AK7 (alt 0) |
  | `coinche` | 1 | AK7 (alt 1, same session `58a49f2e…`) |
- **Mostly convergent** on pass, but AK7 used the "try another answer" flow to record a coinche alternative within the same session — the only multi-alternative session in the dataset.

### 2.4 `petit-jeu-after-partner-80-spades`

- Total annotations: 3 (one per user)
- Exhausted by: Rod_le_thug, Jejemoumou06. AK7 **not** in `_exhausted.json` — their only annotation for this scenario is schema-v1 (no `sessionId`), which matches the documented legacy-handling rule (no backfill).
- Action distribution:
  | Action | Count | Who |
  |---|---|---|
  | `bid 130 S` | 3 | all three users |
- **Fully convergent** on action.

### 2.5 `raise-partner-90-hearts`

- Total annotations: 4 (AK7 × 2, others × 1)
- Exhausted by: all 3 users
- Action distribution:
  | Action | Count | Who |
  |---|---|---|
  | `bid 110 H` | 4 | all three users; AK7 has it twice (one v1 at 05:04, one v2 at 07:08) |
- **Fully convergent** on action. AK7's duplicate is a schema-v1 → schema-v2 re-annotation, not a true alternative.

### Scenario coverage classification

| Scenario | Classification |
|---|---|
| block-120-after-opp-overcall | multiply-exhausted (3/3 users) |
| opening-petit-jeu-first-to-speak | multiply-exhausted (3/3 users) |
| petit-jeu-after-opp-80-spades | multiply-exhausted (3/3 users), 1 multi-alt session |
| petit-jeu-after-partner-80-spades | multiply-exhausted (2/3 users, AK7 legacy-only) |
| raise-partner-90-hearts | multiply-exhausted (3/3 users) |

No scenarios are "untouched" or "partially explored" — all 5 were completed by all 3 users (modulo AK7's legacy-only entry for scenario 2.4).

---

## 3. Tag usage

### 3.1 Histogram (19 tags used across 18 annotations)

| Tag | Count |
|---|---|
| `as-extérieur-1` | 10 |
| `valet-troisième` | 8 |
| `partenaire-ouverture-80` | 6 |
| `passer-faible` | 6 |
| `monter` | 5 |
| `9-second` | 4 |
| `surenchère-compétitive` | 3 |
| `adverse-a-ouvert` | 3 |
| `as-extérieur-0` | 2 |
| `jugement` | 2 |
| `changer` | 2 |
| `partenaire-ouverture-90` | 2 |
| `adverse-a-surenchéri` | 1 |
| `score-équilibré` | 1 |
| `maitre` | 1 |
| `ouverture` | 1 |
| `premier-à-parler` | 1 |
| `coincher` | 1 |
| `incertain` | 1 |

### 3.2 Tags that were NEVER used

Actions covered in the dataset: `bid`, `pass`, `coinche`. No `surcoinche`, no `play-card` decisions.

**Never used across bid + pass + coinche vocab (the reachable ones):**

- **trump-hand:** `valet-second`, `valet-quatrième`, `valet-cinquième`, `9-troisième`, `9-quatrième`, `9-cinquième`, `atout-count-2`, `atout-count-3`, `atout-count-4`, `atout-count-5-plus`, `belote-possible`
- **non-trump-hand:** `as-extérieur-2`, `as-extérieur-3`, `deux-as-bare`, `21`, `deux-21`, `longue`
- **hand-shape:** `bicolore`, `fausse-carte-1`, `fausse-carte-2`
- **bidding-action:** `bloquage`, `faire-monter-pour-coincher`, `cherche-mon-partenaire`, `passer-stratégique`, `surcoincher` (action not reached)
- **partner-context:** `partenaire-ouverture-100`, `partenaire-ouverture-110-plus`, `partenaire-même-couleur`, `partenaire-autre-couleur`
- **score-context:** `score-derrière`, `score-avance`, `dernière-donne`
- **meta:** `autre` (0 uses — no user invoked the vocabulary-gap escape hatch)

**Never used because action was never selected:** all `play-card` tags (20 of them), all `surcoinche` tags.

### 3.3 Top tag co-occurrences (within a single decision)

| Pair | Count |
|---|---|
| `as-extérieur-1` + `valet-troisième` | 6 |
| `partenaire-ouverture-80` + `valet-troisième` | 5 |
| `as-extérieur-1` + `monter` | 4 |
| `as-extérieur-1` + `partenaire-ouverture-80` | 3 |
| `9-second` + `as-extérieur-1` | 3 |
| `9-second` + `monter` | 3 |
| `adverse-a-ouvert` + `valet-troisième` | 3 |
| `as-extérieur-0` + `changer` | 2 |
| `as-extérieur-0` + `partenaire-ouverture-80` | 2 |
| `as-extérieur-0` + `valet-troisième` | 2 |
| `changer` + `partenaire-ouverture-80` | 2 |
| `changer` + `valet-troisième` | 2 |
| `jugement` + `valet-troisième` | 2 |
| `as-extérieur-1` + `passer-faible` | 2 |
| `monter` + `partenaire-ouverture-80` | 2 |
| `monter` + `valet-troisième` | 2 |
| `9-second` + `partenaire-ouverture-90` | 2 |
| `as-extérieur-1` + `partenaire-ouverture-90` | 2 |
| `monter` + `partenaire-ouverture-90` | 2 |
| `partenaire-ouverture-80` + `surenchère-compétitive` | 2 |
| `as-extérieur-1` + `surenchère-compétitive` | 2 |
| `adverse-a-ouvert` + `as-extérieur-1` | 2 |

(60 distinct co-occurring pairs total; tail is all count = 1.)

### 3.4 `autre` selections with note excerpts

**Zero `autre` tags were recorded.** The vocabulary-gap escape hatch was not invoked by any user in this dataset.

---

## 4. Convergence vs. divergence per scenario

### Convergent (all users chose the same action)

- **`petit-jeu-after-partner-80-spades`** — all 3 users: `bid 130 S`
  - Rod_le_thug tags: `valet-troisième`, `as-extérieur-1`, `monter`, `partenaire-ouverture-80`
  - Jejemoumou06 tags: `valet-troisième`, `as-extérieur-1`, `surenchère-compétitive`, `partenaire-ouverture-80`
  - AK7 tags (v1): `valet-troisième`, `as-extérieur-1`, `monter`, `partenaire-ouverture-80`
  - (Note: Rod and AK7 chose `monter` as the bidding-action tag; Jeje chose `surenchère-compétitive`. Same action, different framing of the *why*.)

- **`raise-partner-90-hearts`** — all 3 users: `bid 110 H`
  - Rod_le_thug tags: `9-second`, `as-extérieur-1`, `monter`, `partenaire-ouverture-90`
  - Jejemoumou06 tags: `9-second`, `as-extérieur-1`, `surenchère-compétitive`
  - AK7 v1 tags: `monter`, `9-second`
  - AK7 v2 tags: `9-second`, `as-extérieur-1`, `monter`, `partenaire-ouverture-90`
  - (Same split: `monter` vs `surenchère-compétitive`.)

### Divergent

- **`block-120-after-opp-overcall`** — two users bid 110, one user bid 120 (all ♦)
  | User | Action | Tags | Note |
  |---|---|---|---|
  | Rod_le_thug | `bid 110 D` | `valet-troisième`, `as-extérieur-0`, `partenaire-ouverture-80`, `adverse-a-surenchéri`, `score-équilibré`, `jugement`, `changer` | "Le fait que mon partenaire ait deux as car il a parlé à 80.\nSes deux as ne sont pas dans la couleur de l'atout car je lai,\nJ'ai les trois meilleures carte d'atout" |
  | Jejemoumou06 | `bid 110 D` | `maitre`, `partenaire-ouverture-80`, `surenchère-compétitive` | (empty) |
  | AK7 | `bid 120 D` | `valet-troisième`, `as-extérieur-0`, `changer`, `partenaire-ouverture-80`, `adverse-a-ouvert` | "Ici la mains est forte car on a pas la longue à trèfle mais presque. Dépendant des deux As qu'il a. Si il monte à 130 je sais qu'il a le 3 eme As et je peux dire capot" |
  - Rod and AK7 both tag `as-extérieur-0` + `changer`; Jeje tags `maitre` + `surenchère-compétitive` — different hand readings.

- **`opening-petit-jeu-first-to-speak`** — 3 passes, 1 bid
  | User | Action | Tags | Note |
  |---|---|---|---|
  | Rod_le_thug | `pass` | `as-extérieur-1`, `passer-faible` | "Jeu pas assez solide à l'atout notamment \nPas de longue\nOn est dominé dans toutes les couleurs" |
  | Jejemoumou06 (session 1) | `pass` | `passer-faible` | (empty) |
  | Jejemoumou06 (session 2) | `pass` | `passer-faible` | (empty) |
  | AK7 | `bid 90 S` | `valet-troisième`, `as-extérieur-1`, `ouverture`, `premier-à-parler` | "90 classic" |

- **`petit-jeu-after-opp-80-spades`** — 3 passes, 1 coinche (AK7's alternative)
  | User | Action | Tags | Note |
  |---|---|---|---|
  | Rod_le_thug | `pass` | `passer-faible` | "Main trop faible.\nEn plus je sais que mon adversaire a deux as" |
  | Jejemoumou06 | `pass` | `passer-faible` | (empty) |
  | AK7 (alt 0) | `pass` | `valet-troisième`, `as-extérieur-1`, `passer-faible`, `adverse-a-ouvert`, `jugement` | "J'ai un jeux pour coincher mais je suis pas sure, il les faites. J'espère que sont partenaire monte et que je puisse contrer après" |
  | AK7 (alt 1, same session) | `coinche` | `valet-troisième`, `as-extérieur-1`, `coincher`, `adverse-a-ouvert`, `incertain` | "Techniquement j'ai un 90 à la même couleur, donc je verrais contrer. Le seul problème c'est que quand une partie est contrée l'information change et les joueurs joue accordement. Ce qui aller contre moi." |

---

## 5. Notes corpus sampling (verbatim)

### 5.1 Substantive notes (longer reasoning, judgment-call language)

1. **Rod_le_thug — `block-120-after-opp-overcall` — `bid 110 D`**
   > "Le fait que mon partenaire ait deux as car il a parlé à 80.\nSes deux as ne sont pas dans la couleur de l'atout car je lai,\nJ'ai les trois meilleures carte d'atout"

2. **AK7 — `block-120-after-opp-overcall` — `bid 120 D`**
   > "Ici la mains est forte car on a pas la longue à trèfle mais presque. Dépendant des deux As qu'il a. Si il monte à 130 je sais qu'il a le 3 eme As et je peux dire capot"

3. **Rod_le_thug — `opening-petit-jeu-first-to-speak` — `pass`**
   > "Jeu pas assez solide à l'atout notamment \nPas de longue\nOn est dominé dans toutes les couleurs"

4. **AK7 — `petit-jeu-after-opp-80-spades` — `pass` (alt 0 of multi-alt session)**
   > "J'ai un jeux pour coincher mais je suis pas sure, il les faites. J'espère que sont partenaire monte et que je puisse contrer après"

5. **AK7 — `petit-jeu-after-opp-80-spades` — `coinche` (alt 1 of same session)**
   > "Techniquement j'ai un 90 à la même couleur, donc je verrais contrer. Le seul problème c'est que quand une partie est contrée l'information change et les joueurs joue accordement. Ce qui aller contre moi."

6. **Rod_le_thug — `petit-jeu-after-partner-80-spades` — `bid 130 S`**
   > "Mon partenaire parle à 80 pic.\nJe sais qu'il a deux as\nComme j'ai la puce (valet ou neuf) avec deux autres cartes à pic, je monte à 120.\nComme j'ai un as en plus je monte à 130."

7. **Rod_le_thug — `raise-partner-90-hearts` — `bid 110 H`**
   > "J'ai le neuf avec au moins une autre carte à l'atout donc je monte à 100.\nEt comme j'ai un as extérieur je monte à 110"

8. **Rod_le_thug — `petit-jeu-after-opp-80-spades` — `pass`**
   > "Main trop faible.\nEn plus je sais que mon adversaire a deux as"

9. **AK7 — `opening-petit-jeu-first-to-speak` — `bid 90 S`** (short but a convention reference)
   > "90 classic"

### 5.2 Blank / trivial notes

All of these are empty strings (`note: ""`):

1. Jejemoumou06 — `opening-petit-jeu-first-to-speak` (session `6ffd58e2…`, pass)
2. Jejemoumou06 — `opening-petit-jeu-first-to-speak` (session `a659baa6…`, pass)
3. Jejemoumou06 — `block-120-after-opp-overcall` (bid 110 D)
4. Jejemoumou06 — `petit-jeu-after-opp-80-spades` (pass)
5. Jejemoumou06 — `petit-jeu-after-partner-80-spades` (bid 130 S)
6. Jejemoumou06 — `raise-partner-90-hearts` (bid 110 H)
7. AK7 v1 — `petit-jeu-after-partner-80-spades` (bid 130 S, 2026-04-21T05:02:55Z)
8. AK7 v1 — `raise-partner-90-hearts` (bid 110 H, 2026-04-21T05:05:31Z)
9. AK7 v2 — `raise-partner-90-hearts` (bid 110 H, 2026-04-21T07:09:30Z)

Jejemoumou06 contributed 0 notes across all 6 annotations. AK7's v1 entries and one v2 raise-partner entry are also blank. Rod_le_thug wrote a note on every one of their 5 annotations.

---

## 6. Open questions / observations

*(Presented as-is, no interpretation.)*

- **Two schema versions coexist in the same dataset.** AK7 has 2 schema-v1 annotations (at 05:01 and 05:04 UTC) and 5 schema-v2 annotations (at 06:59–07:09 UTC). The schema bump happened between those two windows. AK7's v1 `petit-jeu-after-partner-80-spades` annotation is *not* reflected in `_exhausted.json` — only v2 sessions feed the exhaustion sidecar, per the legacy-handling rule. So AK7's `_exhausted.json` has 4 entries even though they annotated 5 distinct scenarios.

- **Jejemoumou06 has 2 annotations for `opening-petit-jeu-first-to-speak`**, each with a different `sessionId` (`6ffd58e2…` at 18:20, `a659baa6…` at 18:25), both with `alternativeIndex: 0`, both with action `pass` and tags `[passer-faible]`. Only the later session is listed in `_exhausted.json`. This looks like the user started two separate sessions for the same scenario rather than using the "try another answer" alternatives flow within one session.

- **`alternativesRecorded: 2` appears exactly once** — AK7's `petit-jeu-after-opp-80-spades` session `58a49f2e…`, which recorded a `pass` alternative then a `coinche` alternative. This is the only multi-alternative session across all 3 users. Every other scenario-per-user ended after one alternative.

- **`autre` was never selected** (0 uses). No user hit the "none of these fit" escape hatch.

- **Only 19 of the bid/pass/coinche vocabulary tags were used.** The large set of never-used tags includes whole subgroups (`hand-shape`: 0 uses; `score-context`: only `score-équilibré` once; `partner-context` beyond 80/90: 0). `play-card` and `surcoinche` were unreachable because the corresponding decisions never occurred.

- **Bidding-action terminology split on "raise" scenarios.** When all users agreed on the same raise (scenarios 2.4 and 2.5), they still disagreed on whether the action-tag is `monter` or `surenchère-compétitive`. Jeje consistently picked `surenchère-compétitive`; Rod and AK7 consistently picked `monter`. *(Quoted, not interpreted.)*

- **Notes density is uneven across users.** Rod_le_thug wrote detailed notes on every annotation (5/5 non-empty, average length ~160 chars with structured line breaks). AK7 wrote notes on 4/7 (0/2 v1 and 4/5 v2). Jejemoumou06 wrote 0/6 notes.

- **Jejemoumou06's tag sets are consistently the shortest** — often a single tag (`passer-faible` alone four times). Rod's and AK7's tag sets typically span 3–7 tags.

- **No schema irregularities** beyond the v1/v2 split noted above. All `schemaVersion` values are 1 or 2; all `tagsSchemaVersion` values are 2; all `scenarioSchemaVersion` values are 1. All `status` values are `"complete"`. Every v2 annotation has a `sessionId`, `alternativeIndex`, and `sessionStatus`; every v1 annotation lacks them. No malformed records.

- **Date range is a single day** (2026-04-21), with three distinct bursts: AK7 05:01–05:05 UTC (v1), AK7 06:59–07:09 UTC (v2), Jejemoumou06 18:19–18:25 UTC, Rod_le_thug 18:24–18:32 UTC. The two later users overlapped.
