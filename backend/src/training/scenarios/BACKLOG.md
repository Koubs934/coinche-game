# Scenario Backlog

Scenarios identified during earlier design work but not yet authored. File them here so the probes aren't forgotten between batches. When authoring, move the entry into an actual `<id>.json` under this directory and delete it from the list.

---

## Pending

### `petit-jeu-in-different-suit-than-partner-info-80`
Partner opens 80♠ informative; user holds a Pattern A petit-jeu in a **different** suit (not ♠).

**Probes:** support-vs-switch as a distinct *action*, not distinct *reasoning* for the same action. Scenario 3 already covers the overlap case (same-suit → 90♠ either way, different tag reveals the reasoning). This variant distinguishes it by making the bid itself different depending on which reasoning wins — partner-suit bid (supporting-partner) vs user-suit bid (switching-to-own-suit).

**Hand constraint:** user's petit-jeu must be in a suit strictly other than ♠. Partner's info-80 shape stays the same (2+ Aces, ♠ highest trumpPtsSum). Both scenarios (this and `petit-jeu-after-partner-80-spades`) matter; don't collapse them into one.

---

## Authored

All scenarios are now `schemaVersion: 2`. Each carries optional `expectedAnswer` (action + ruleReference, or `null`) and `ambiguityFlags` fields. **The JSON files are the source of truth** — the tables below are human-readable mirrors. Analysis tooling reads from the JSONs (`scripts/build-training-snapshot.js`).

The expectedAnswer field is loader-side only: it must NEVER be exposed in the picker or reason-panel UI (would bias data collection).

### V1-era probes (5 scenarios)

| File | Expected | ruleReference / ambiguityFlags |
|---|---|---|
| `opening-petit-jeu-first-to-speak.json` | pass | `opening:pass-no-pattern-qualifies` (J-3rd alone is not a V2 90 pattern; needs belote, piece-4th, or J+9+1 + outside Ace) |
| `petit-jeu-after-opp-80-spades.json` | _(unspecified)_ | `expectedAnswer: null`, flag `competitive-bidding-not-formalized` |
| `petit-jeu-after-partner-80-spades.json` | bid 130 ♠ | `response-to-80:130:piece-3rd+1as` |
| `block-120-after-opp-overcall.json` | _(unspecified)_ | `expectedAnswer: null`, flag `competitive-bidding-not-formalized` |
| `raise-partner-90-hearts.json` | bid 120 ♥ | `response-to-90:120:piece-2nd` (note: existing user data has 110♥ — V1-style "+10/Ace"; the consistency report will surface this divergence) |

### La Feuille V2 — 20-row validation table
Drawn verbatim from `la-feuille-v2.md` §"20 scénarios de validation". Each is a first-to-speak opening with a known expected bid per the V2 rules.

| File | Hand | Expected | ruleReference |
|---|---|---|---|
| `validation-scenario-01.json` | K♠ Q♠ 8♠ 7♥ 9♦ 8♦ Q♣ 7♣ | PASS | `opening:pass-no-pattern-qualifies` |
| `validation-scenario-02.json` | A♠ 8♠ 7♠ Q♥ J♥ 10♦ 8♣ 7♣ | PASS | `opening:pass-no-pattern-qualifies` |
| `validation-scenario-03.json` | A♠ K♠ A♥ 10♥ 7♥ A♦ 8♣ 7♣ | PASS | `opening:80-needs-exactly-2-aces` |
| `validation-scenario-04.json` | A♠ K♠ A♥ 10♥ 8♥ J♦ 9♣ 7♣ | PASS | `opening:80-needs-petit-jeu` |
| `validation-scenario-05.json` | A♠ Q♠ A♥ 10♥ 7♥ J♦ 8♦ 7♣ | 80 ♦ | `opening:80:two-aces+petit-jeu` |
| `validation-scenario-06.json` | A♠ K♠ A♦ 10♦ 7♦ 9♥ 8♣ 7♣ | PASS | `opening:pass-no-pattern-qualifies` |
| `validation-scenario-07.json` | J♠ 10♠ 8♠ 7♠ A♥ Q♥ K♦ 9♣ | 90 ♠ | `opening:90:piece-4th+as-ext` |
| `validation-scenario-08.json` | J♠ K♠ Q♠ A♥ 10♥ 8♥ 7♦ 9♣ | 90 ♠ | `opening:90:valet-3rd+belote+as-ext` |
| `validation-scenario-09.json` | J♠ 9♠ 8♠ A♥ K♥ Q♥ 7♦ 10♣ | 90 ♠ | `opening:90:V+9+1+as-ext` |
| `validation-scenario-10.json` | J♠ 9♠ A♠ 7♠ K♥ Q♥ J♦ 10♣ | 100 ♠ | `opening:100:maitre` |
| `validation-scenario-11.json` | J♣ 9♣ A♣ K♣ Q♣ 10♥ J♦ 8♦ | 100 ♣ | `opening:100:maitre` |
| `validation-scenario-12.json` | J♠ 9♠ A♠ 7♠ A♥ Q♥ J♦ 10♣ | 110 ♠ | `opening:110:maitre+1as_ext` |
| `validation-scenario-13.json` | J♣ 9♣ A♣ 10♣ A♠ K♠ A♥ 7♦ | 110 ♣ | `opening:110:maitre+1as_ext` |
| `validation-scenario-14.json` | J♥ 9♥ A♥ K♥ A♣ 10♣ 9♣ 8♣ | 120 bicolore ♥ | `opening:120-bicolore` |
| `validation-scenario-15.json` | J♠ 9♠ A♠ K♠ Q♠ A♥ 10♥ 7♥ | 120 bicolore ♠ | `opening:120-bicolore` |
| `validation-scenario-16.json` | J♥ 9♥ A♥ K♥ A♣ 10♣ 9♣ 7♠ | 110 ♥ | `opening:110:maitre+1as_ext` |
| `validation-scenario-17.json` | J♠ 9♠ A♠ 8♠ A♥ Q♥ J♦ 10♣ | 110 ♠ | `hierarchy:100+_priority_over_80` |
| `validation-scenario-18.json` | J♠ 9♠ 8♠ A♥ K♥ Q♥ 8♦ A♣ | 80 ♠ | `hierarchy:80_priority_over_90` |
| `validation-scenario-19.json` | J♠ 9♠ 8♠ 7♠ J♥ K♥ Q♥ A♦ | 90 (couleur libre) | `tie-break-not-formalized`, flag `tie-break-not-formalized` |
| `validation-scenario-20.json` | J♠ 9♠ 8♠ J♥ 9♥ K♥ A♦ A♣ | 80 (couleur libre) | `tie-break-not-formalized`, flag `tie-break-not-formalized` |

---

## Authored — Round 2 (2026-05-04)

100 hand-designed scenarios systematically covering La Feuille V2.1's formalized clauses and surfacing rule-silent zones. Generator is at `backend/scripts/gen-round-2.js` (+ `gen-round-2-data.js` for the spec table); deleted from the repo before commit but preserved here in BACKLOG for the audit trail of how each scenario was constructed.

70 of these 100 carry `expectedAnswer: null` — they're rule-silent probes for future formalization.

### opening-NN-* (15) — first-to-speak openings beyond the validation set
`maitre-and-3-outside-aces`, `piece-4th-no-outside-ace`, `borderline-80-vs-90-piece-3rd-belote`, `maitre-bicolore-7-1-side`, `maitre-bicolore-6-2-side`, `no-piece-4-trumps-belote`, `no-piece-5-trumps`, `one-ace-piece-3rd-belote`, `one-ace-J-9-1-other`, `two-aces-no-petit-jeu`, `maitre-outside-J-no-bicolore`, `maitre-110-ace-in-singleton`, `three-aces-no-piece`, `piece-4th-second-pattern-9-fourth`, `maitre-with-side-piece-not-exploitable`.

### response-XX-NN-* (15) — 3 each on partner 80/90/100/110/120
`response-80`: piece-3rd-no-aces, piece-2nd-2-aces, no-piece-no-aces-pass.
`response-90` (V2.1 corrected): piece-2nd-1-ace, three-aces-self-contradicts, one-ace-no-piece-pass.
`response-100`: one-outside-ace, two-outside-aces, no-outside-ace-silent.
`response-110`: one-extra-ace, two-extra-aces, no-extra-ace-silent.
`response-120` (bicolore): three-aces, piece-of-trump, two-aces-no-piece-pass.

### second-pass-NN-* (15) — partner passed first; rule-silent
strong-110-after-partner-pass, borderline-90-after-partner-pass, weak-pass-after-partner-pass, maitre-no-ace-after-partner-pass, eighty-info-after-partner-pass, bicolore-120-after-partner-pass, one-piece-1-ace-marginal, two-aces-no-petit-jeu-after-pass, three-aces-no-piece-after-pass, long-trump-no-ace-after-pass, piece-2nd-marginal-90, maitre-bicolore-pure, piece-4th-with-ace-after-pass, three-pieces-different-suits, border-between-pass-and-90.

### second-opp-opened-NN-* (20) — opp opened first; rule-silent
opp-80h-user-strong-other, opp-80s-user-petit-jeu-clubs, opp-80d-user-pass, opp-80c-user-coinche-territory, opp-80h-user-same-suit-strong, opp-90s-user-strong-clubs, opp-90h-user-90-spades, opp-90c-user-pass, opp-90d-user-bicolore, opp-90s-user-coinche, opp-100h-user-strong-spades, opp-100s-user-pass, opp-100d-user-coinche-attempt, opp-100c-user-bicolore, opp-110s-user-bicolore-other, opp-110h-user-coinche, opp-110d-user-pass, opp-120s-user-three-aces, opp-120h-user-coinche, opp-120d-user-pass.

### partner-opened-opp-overcalled-NN-* (15) — competitive; rule-silent
partner-80s-opp-90h, partner-100s-opp-110h, partner-90h-opp-100s, partner-80h-opp-coinche-territory, partner-110s-opp-120h, partner-90s-opp-90h, partner-100h-opp-110s, plus competitive-8 through competitive-15 (8 scenarios with shared partner 80♠ + opp 90♥ context, varying user hands).

### fourth-position-NN-* (10) — rule-silent
all-passed-1, all-passed-2, all-passed-3, all-passed-4, opp-left-opened-1, opp-left-opened-2, opp-left-opened-3, partner-overcalled-1, partner-overcalled-2, partner-overcalled-3.

### coinche-NN-* (5) — rule-silent
simple-coinche-opp-100, simple-coinche-opp-110, opp-coinche-partner-bid, surcoinche-after-opp-coinche, surcoinche-of-opp-coinche-of-partner-110.

### exotic-NN-* (5) — rule-silent
capot-potential-7-trumps, long-suit-no-piece, all-singletons-3-aces, eight-zero-zero-zero-impossible, maitre-with-quasi-bicolore.

### Picker order
The picker no longer sorts scenarios alphabetically. `scenarioLoader.listScenarios()` now hash-shuffles by SHA-256(id) so categories interleave in the picker rather than appearing as long blocks. Order is deterministic — same across users and across loads. See `scenarioLoader.test.js` for the determinism test.
