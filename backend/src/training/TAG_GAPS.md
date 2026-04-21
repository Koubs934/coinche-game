# Tag Vocabulary Gaps

Real-use observations where existing tags didn't capture user reasoning.
Review in batches, not individually. Update the vocabulary in a coordinated
schemaVersion bump when patterns become clear.

## 2026-04-21 — exhaustion session model (schemaVersion 1 → 2)

Annotations now group into **exhaustion sessions**: user records
alternative bids for a scenario until they indicate "no more strategies,"
at which point the scenario is marked exhausted for that user and hidden
from the picker. Each alternative is a separate annotation file with a
shared `sessionId` and an incrementing `alternativeIndex`. Sidecar
`_exhausted.json` per user tracks exhausted scenarios with their
`sessionId` + `alternativesRecorded` count.

Supports **conditional-reasoning capture**: the user can encode "normally
I bid X, but under pressure I bid Y, and if partner's shape suggests Z
I'd pass" — each distinct read recorded as its own alternative with its
own tags and note. The dataset shifts from single-decision-per-scenario
to decision-landscape-per-scenario, which is what the rule extractor
needs to cluster by tag-set and infer bid-selection rules.

New error codes: **`DUPLICATE_BID_IN_SESSION`** (same `bid` value + suit
submitted twice within a session — hard refuse), **`UNKNOWN_SESSION`**
(review answer for non-existent session — defensive check). The duplicate
check applies to bid-type actions only; pass / coinche / surcoinche
uniqueness is deferred until real usage patterns emerge.

Legacy `schemaVersion: 1` annotations (the two v2-legacy records from
the 2026-04-21 smoke tests) remain on disk as-is. The rule extractor
treats a missing `sessionId` as a single-alternative legacy session. No
backfill. Full field reference in [`docs/tags-v2-spec.md`](../../../docs/tags-v2-spec.md)
under "Exhaustion sessions".

## 2026-04-21 — v1 → v2 migration

Rationale: v1 grouped tags by conclusion type (`hand-claim`, `tactical`,
etc.), which obscured the atomic features a bot could evaluate. v2 regroups
by reasoning primitives (trump hand, non-trump hand, shape, action,
partner/opponent/score context), making each tag correspond to a boolean
evaluable against hand + bidding state. This is the prerequisite for the
rule extraction step — annotations pair tag-sets (features) with action
values (labels), and the extractor clusters by tag-set to derive
bid-selection rules.

Changes: 62 → 56 v2 tags (plus the preserved play-card legacy set). Hand
composition dramatically more granular (14 trump-hand tags vs v1's generic
`maitre-claim`). Non-trump strength now explicit. Coinche/surcoinche
reasoning deferred to `autre` + free text until patterns emerge. Score
context added (was missing in v1).

v1 vocabulary preserved at `reasonTags.v1.json` for historical reference.
8 existing production annotations re-tagged under v2 (see
`backend/data/training/_retag-v2-draft-output/RETAG-REPORT.md`). Full v2
spec at [`docs/tags-v2-spec.md`](../../../docs/tags-v2-spec.md).

## Bid

### 2026-04-20 — "Soliciting partner info"
Note: "Partenaire annoncé 80, 2 as. J'ai un bon jeu a carreaux. Je monte de 10,
j'espère qu'il m'annonce la pièce manquante."
Gap: User bidding to request partner reveal missing trump honour on their next
turn. Not a claim, not a switch, not a speculative raise. Candidate tag:
`soliciting-partner-info`. Wait for more examples before adding.

> Note (2026-04-21): v2 covers this as `cherche-mon-partenaire`
> (information bid to partner, not claim). The gap is closed.
