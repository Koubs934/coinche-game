# Sacha (Faispaschier) — annotation snapshot

Pulled: 2026-05-04 from production volume (`/data/training/507f441f-a481-4269-9d18-356b9ba76f43/`).
Source mirror: `backend/data/training/_sacha-snapshot/` (gitignored).

## 1. Summary stats

| Metric | Value |
|---|---|
| Total annotations | 35 |
| Session start | 2026-05-04T18:17:50.143Z |
| Session end   | 2026-05-04T18:45:34.094Z |
| Session duration | 28 min |

### Divergence type breakdown

| Type | Count | % |
|---|---|---|
| match | 10 | 29% |
| value-different | 2 | 6% |
| suit-different | 0 | 0% |
| action-type-different | 0 | 0% |
| rule-silent | 23 | 66% |

### Agreement breakdown (when divergent)

| Agreement | Count | % |
|---|---|---|
| could-be-either | 0 | 0% |
| user-disagrees | 2 | 6% |
| null | 33 | 94% |

### Scenario category breakdown

| Category | Count |
|---|---|
| `response` | 15 |
| `second-opp-opened` | 12 |
| `partner-opened-opp-overcalled` | 5 |
| `v1-original` | 3 |

## 2. Match table — Sacha aligned with La Feuille V2.1

Scenarios where Sacha's action exactly matched the rule's expected answer (silent submit, no reasoning UI shown).

| # | Scenario | Action |
|---|---|---|
| 1 | `petit-jeu-after-partner-80-spades` | 130 ♠ |
| 2 | `response-100-01-one-outside-ace` | 110 ♠ |
| 3 | `response-100-02-two-outside-aces` | 120 ♠ |
| 4 | `response-110-01-one-extra-ace` | 120 ♠ |
| 5 | `response-110-02-two-extra-aces` | 130 ♠ |
| 6 | `response-120-01-three-aces` | 130 ♠ |
| 7 | `response-120-03-two-aces-no-piece-pass` | pass |
| 8 | `response-80-01-piece-3rd-no-aces` | 120 ♠ |
| 9 | `response-80-02-piece-2nd-2-aces` | 110 ♠ |
| 10 | `response-90-03-one-ace-no-piece-pass` | 100 ♠ |

## 3. Divergence drill-down — formalized scenarios

Scenarios where La Feuille V2.1 has a non-null `expectedAnswer` but Sacha picked a different action. **"Pas d'accord" (`user-disagrees`) cases are the strongest signals for La Feuille revision.**

### `raise-partner-90-hearts` — 🔴 **Pas d'accord (hard divergence)**

- **Expected (La Feuille)**: 110 ♥ — `response-to-90:110:piece-2nd`
- **Sacha's action**: 130 ♥
- **Divergence type**: `value-different`
- **Note**:

> La pièce second sur ouverture 90 120 + 1 as 130

### `response-90-01-piece-2nd-1-ace` — 🔴 **Pas d'accord (hard divergence)**

- **Expected (La Feuille)**: 110 ♠ — `response-to-90:110:piece-2nd`
- **Sacha's action**: 120 ♠
- **Divergence type**: `value-different`
- **Note**:

> Ouverture 90 
> Réponse la pièce second 110 + 1 as 120

## 4. Rule-silent annotations

Scenarios where La Feuille does not (yet) have a formalized answer. Sacha's notes here are evidence for *future* rule extension. Grouped by scenario category.

### Category: `partner-opened-opp-overcalled` (5 annotations)

#### `partner-opened-opp-overcalled-11-competitive-11`

- **Sacha's action**: 130 ♠
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> 34 quatrième sur ouverture 80

#### `partner-opened-opp-overcalled-12-competitive-12`

- **Sacha's action**: 120 ♠
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> La pièce troisième ( en l’occurrence j’ai une bonne surprise pour lui car j’en ai 4 ) mais il peut pas le savoir

#### `partner-opened-opp-overcalled-13-competitive-13`

- **Sacha's action**: 130 ♠
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> Même principe que précédemment la pièce troisième donc 120 + 1 as 130 
> Et bonne surprises pour lui j’en ai 4 mais il peut pas le savoir

#### `partner-opened-opp-overcalled-14-competitive-14`

- **Sacha's action**: 130 ♠
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> La pièce 3eme plus 1 as donc 120 +10
> Et le 4 eme atout c’est la surprise on peut pas l’annoncer

#### `partner-opened-opp-overcalled-15-competitive-15`

- **Sacha's action**: capot ♠
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> Je l’annonce que si c’est un bon joueur en coéquipier car on a la partance

### Category: `second-opp-opened` (12 annotations)

#### `second-opp-opened-01-opp-80h-user-strong-other`

- **Sacha's action**: 110 ♠
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> Maître a l’atout 100 + 1 as 110

#### `second-opp-opened-02-opp-80s-user-petit-jeu-clubs`

- **Sacha's action**: 100 ♣
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> Vu que j’ai le 34 je jump de 10

#### `second-opp-opened-03-opp-80d-user-pass`

- **Sacha's action**: pass
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> Rien à dire

#### `second-opp-opened-04-opp-80c-user-coinche-territory`

- **Sacha's action**: pass
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> Rien à dire

#### `second-opp-opened-05-opp-80h-user-same-suit-strong`

- **Sacha's action**: coinche
- **Scenario flags**: `competitive-bidding-not-formalized`, `opp-80-self-contradicts-with-user-hand`
- **Note**:

> Là il faut chambrer toute la mène

#### `second-opp-opened-06-opp-90s-user-strong-clubs`

- **Sacha's action**: 120 ♣
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> Bloquage et laisse la possibilité que le partenaire ai les 3 as extérieur pour dire capot

#### `second-opp-opened-07-opp-90h-user-90-spades`

- **Sacha's action**: 100 ♠
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> Je pourrait dire 120 mais je ne pense pas les faire …

#### `second-opp-opened-08-opp-90c-user-pass`

- **Sacha's action**: pass
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> Rien à dire

#### `second-opp-opened-09-opp-90d-user-bicolore`

- **Sacha's action**: 150 ♠
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> Selon le score je peux même tenter le capot pour marqué plus et en prenant un peu de risque

#### `second-opp-opened-10-opp-90s-user-coinche`

- **Sacha's action**: pass
- **Scenario flags**: `competitive-bidding-not-formalized`, `opp-bid-self-contradicts`
- **Note**:

> Rien à dire

#### `second-opp-opened-11-opp-100h-user-strong-spades`

- **Sacha's action**: 110 ♠
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> Je devrait jumper de 10 mais j’ai peur de chuter

#### `second-opp-opened-12-opp-100s-user-pass`

- **Sacha's action**: 110 ♥
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> C long ton entraînement casse les couilles

### Category: `response` (5 annotations)

#### `response-100-03-no-outside-ace-silent`

- **Sacha's action**: pass
- **Scenario flags**: `response-pass-not-formalized`
- **Note**:

> Pas d’as et pas de quoi changer mais le contrat s’annonce difficile à faire

#### `response-110-03-no-extra-ace-silent`

- **Sacha's action**: pass
- **Scenario flags**: `response-pass-not-formalized`
- **Note**:

> Pas d’as pas d’autres couleur

#### `response-120-02-piece-of-trump`

- **Sacha's action**: pass
- **Scenario flags**: `response-self-contradictory`
- **Note**:

> Ouverture de mon partenaire 2 réponse possible 
> 3 as extérieur +10
> La pièce +10

#### `response-80-03-no-piece-no-aces-pass`

- **Sacha's action**: 90 ♥
- **Scenario flags**: `response-pass-not-formalized`
- **Note**:

> Je n’ai pas d’atout pour lui alors je le cherche ailleurs sinn on va chuter

#### `response-90-02-three-aces-self-contradicts`

- **Sacha's action**: 110 ♠
- **Scenario flags**: `response-rule-self-contradicts`
- **Note**:

> Je lui donne mes 2 as

### Category: `v1-original` (1 annotation)

#### `petit-jeu-after-opp-80-spades`

- **Sacha's action**: pass
- **Scenario flags**: `competitive-bidding-not-formalized`
- **Note**:

> Rien à dire il parle dans mon tchik et j’ai pas de quoi le contrer

## 5. Patterns and observations

Mechanical aggregates over the 35 annotations — no interpretive conclusions drawn here.

### 5.1 Action distribution

| Action | Count |
|---|---|
| pass | 9 |
| coinche | 1 |
| surcoinche | 0 |
| bid 90 | 1 |
| bid 100 | 3 |
| bid 110 | 6 |
| bid 120 | 6 |
| bid 130 | 7 |
| bid 150 | 1 |
| bid capot | 1 |

### 5.2 Trump suit choice (bids only)

| Suit | Count |
|---|---|
| ♠ S | 20 |
| ♥ H | 3 |
| ♦ D | 0 |
| ♣ C | 2 |
| couleur libre | 0 |

### 5.3 Direction of divergence (formalized scenarios only)

| Direction | Count |
|---|---|
| Bid higher than expected | 2 |
| Bid lower than expected | 0 |
| Same value, different suit | 0 |
| Bid where rules said pass | 0 |
| Passed where rules said bid | 0 |

### 5.4 Note length

| Metric | Value |
|---|---|
| Annotations with non-empty note | 25 of 35 |
| Median note length (chars) | 48 |
| Mean note length (chars) | 54 |
| Longest note (chars) | 135 |

### 5.5 Coinche / surcoinche usage

Sacha used `coinche` 1 time and `surcoinche` 0 times.

Coinche scenarios encountered:
- `second-opp-opened-05-opp-80h-user-same-suit-strong` — coinche

### 5.6 Hard divergence ("Pas d'accord") concentration

Sacha said "Pas d'accord" on 2 of 35 annotations (6%). The scenarios are:

- `raise-partner-90-hearts` — expected 110 ♥, Sacha 130 ♥
- `response-90-01-piece-2nd-1-ace` — expected 110 ♠, Sacha 120 ♠

