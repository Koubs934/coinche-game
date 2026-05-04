# Training mode — divergence-driven flow (v3)

`schemaVersion: 3` for annotations • Ship date: 2026-05-04
Supersedes the v2 structured-tag vocabulary documented in [`tags-v2-spec.md`](./tags-v2-spec.md).

## Conceptual overview

The v2 design captured user reasoning by asking annotators to pick from ~50
structured tags across 8 categories. After 18 annotations across 3 users,
two things became clear:

1. **Tag aggregation was not feeding the analysis pipeline.** The pipeline
   is LLM-based — Claude reads the dataset and synthesizes findings. Free
   text is the actual workflow; tag sets were lossy summaries of richer
   notes the same users wrote anyway.
2. **Structured tagging is friction.** Picking 4-7 tags per decision before
   even getting to the note discouraged annotation. Two of the three users
   wrote zero or near-zero notes; the bulk of structured-tag information
   was redundant with the action they'd already chosen.

The v3 design pivots: **annotation cost scales with disagreement**.

- If the user's action matches what `la-feuille-v2.md` says: nothing to
  explain. Submit silently.
- If the user diverges: ask one yes/no — could the rule's answer also work
  here? — and require a free-text note.
- If the rules don't cover the case (rule-silent scenarios like competitive
  bidding): require a note. The user's reasoning is the data point.

This concentrates rich, costly annotation effort on the cases where the
rules and reality disagree — exactly the cases that matter for refining
the convention.

## Annotation schema (v3)

Each annotation file (`backend/data/training/<userId>/<isoStamp>-<scenarioId>.json`)
has shape:

```json
{
  "schemaVersion": 3,
  "scenarioId": "...",
  "scenarioSchemaVersion": 2,
  "userId": "...",
  "username": "...",
  "startedAt": "ISO 8601",
  "completedAt": "ISO 8601",
  "status": "complete",
  "sessionId": "...",
  "alternativeIndex": 0,
  "sessionStatus": "in-progress" | "concluded",
  "decisions": [
    {
      "index": 0,
      "timelineStep": N,
      "phase": "BIDDING" | "PLAYING",
      "action": { "type": "bid", "value": 110, "suit": "S" } | { "type": "pass" } | ...,
      "divergenceType":      null | "value-different" | "suit-different" | "action-type-different" | "rule-silent",
      "divergenceAgreement": null | "could-be-either" | "user-disagrees",
      "note":                "<string, possibly empty>",
      "decidedAt":           "ISO 8601"
    }
  ]
}
```

Removed vs v2: `tags` array, `tagsSchemaVersion` field. The v2 records on
disk keep their old shape and remain loadable.

### `divergenceType` enum

Computed by the server at submission time, never sent by the client:

| Value | Meaning |
|---|---|
| `null`                    | Match. User's action equals scenario's `expectedAnswer.action`. (Free-color: any suit counts as match when `expectedAnswer.action.suit === null`.) |
| `value-different`         | Same action type and suit, different value. (Or both axes differ — value is the documented fallback.) |
| `suit-different`          | Same action type and value, different suit. |
| `action-type-different`   | Different action type altogether (e.g., user passed but rules said bid). |
| `rule-silent`             | Scenario has `expectedAnswer: null` (rules don't cover the case). |

### `divergenceAgreement` enum

The user's yes/no answer when the divergence dialogue was shown:

| Value | When |
|---|---|
| `"could-be-either"` | User said "Oui" — they picked something else but conceded the rule answer could also work. **Soft divergence.** |
| `"user-disagrees"`  | User said "Non" — they think the rule answer is wrong here. **Hard divergence.** |
| `null`              | Match case (no question asked) OR rule-silent case (no alternative to compare against). |

## The three UI states

### 1. Match — silent submit
User picked exactly what the rules suggest. The frontend computes this
client-side from `trainingState.expectedAction` (delivered by the server
only after the user has acted, never before — the picker filter still
hides it). Auto-emits `submitTrainingReason` with `divergenceAgreement: null`,
`note: ''`. The user never sees a reasoning UI.

### 2. Divergent — yes/no + required note
```
Vous avez choisi : [user action]
Les règles suggèrent : [expected action]

Pourriez-vous avoir [expected action] aussi ?
○ Oui    ○ Non

Pourquoi ce choix ?  (requis)
[textarea]

[Valider]    ← disabled until both fields are set
```

### 3. Rule-silent — required note
```
Vous avez choisi : [user action]
Les règles ne couvrent pas ce cas — votre raisonnement nous aide à les construire.

Pourquoi ce choix ?  (requis)
[textarea]

[Valider]    ← disabled until note non-empty
```

No yes/no in this state — there is no rule answer to compare against.

## Three data classes for analysis

The snapshot tooling (`scripts/build-training-snapshot.js`) reports four
buckets per user and per scenario:

| Class | Signal |
|---|---|
| **Match** (`divergenceType === null`) | The convention is working. User and rule agree. |
| **Soft divergence** (`divergenceAgreement === "could-be-either"`) | Either-way territory. User has an alternative that they think coexists with the rule. Useful for documenting acceptable variance. |
| **Hard divergence** (`divergenceAgreement === "user-disagrees"`) | High-priority signal. User actively rejects the rule answer. Either the rule is wrong, the scenario is mis-classified, or the user is misapplying. Worth a focused review. |
| **Rule-silent** (`divergenceType === "rule-silent"`) | Rule-discovery territory. The rules don't address the case. User notes are evidence for *new* rules, not consistency checks. |

## Migration note

The 18 schemaVersion 2 annotations from the 2026-04-21 dataset remain in
the dataset as **legacy**. They carry tags but no divergenceType / agreement
fields; the snapshot tool surfaces them in a separate "Legacy v2 dataset"
section and runs the older expectedAnswer-vs-action consistency check on
them (the check that originally surfaced the V2.1 correction).

## Bot vocabulary (future)

The user-facing flow has no tags. Bot vocabulary tags — keys that map onto
hand-feature predicates a bot can evaluate (`piece-2nde`, `as-extérieur-1`,
`maitre+1as_ext`, etc.) — will be re-introduced in **backend-only** logic
during rule extraction. Those tags will be derived from the action +
scenario hand by deterministic functions; the user never picks them. This
is the architectural inversion that makes v3 cheap to annotate without
losing the structured signal needed for rule extraction.
