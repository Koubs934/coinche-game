# Tag Vocabulary Gaps

Real-use observations where existing tags didn't capture user reasoning.
Review in batches, not individually. Update the vocabulary in a coordinated
schemaVersion bump when patterns become clear.

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
