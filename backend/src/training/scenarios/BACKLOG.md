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

### V1-era probes (5 scenarios)
- `opening-petit-jeu-first-to-speak`
- `petit-jeu-after-opp-80-spades`
- `petit-jeu-after-partner-80-spades`
- `block-120-after-opp-overcall`
- `raise-partner-90-hearts`

### La Feuille V2 — 20-row validation table
Drawn verbatim from `la-feuille-v2.md` §"20 scénarios de validation". Each is a first-to-speak opening with a known expected bid per the V2 rules. The expected answer is recorded in the title and notes only — no `expectedAnswer` field on the JSONs yet (schema bump pending in a follow-up).

| File | Hand | Expected |
|---|---|---|
| `validation-scenario-01.json` | K♠ Q♠ 8♠ 7♥ 9♦ 8♦ Q♣ 7♣ | PASS |
| `validation-scenario-02.json` | A♠ 8♠ 7♠ Q♥ J♥ 10♦ 8♣ 7♣ | PASS |
| `validation-scenario-03.json` | A♠ K♠ A♥ 10♥ 7♥ A♦ 8♣ 7♣ | PASS |
| `validation-scenario-04.json` | A♠ K♠ A♥ 10♥ 8♥ J♦ 9♣ 7♣ | PASS |
| `validation-scenario-05.json` | A♠ Q♠ A♥ 10♥ 7♥ J♦ 8♦ 7♣ | 80 ♦ |
| `validation-scenario-06.json` | A♠ K♠ A♦ 10♦ 7♦ 9♥ 8♣ 7♣ | PASS |
| `validation-scenario-07.json` | J♠ 10♠ 8♠ 7♠ A♥ Q♥ K♦ 9♣ | 90 ♠ |
| `validation-scenario-08.json` | J♠ K♠ Q♠ A♥ 10♥ 8♥ 7♦ 9♣ | 90 ♠ |
| `validation-scenario-09.json` | J♠ 9♠ 8♠ A♥ K♥ Q♥ 7♦ 10♣ | 90 ♠ |
| `validation-scenario-10.json` | J♠ 9♠ A♠ 7♠ K♥ Q♥ J♦ 10♣ | 100 ♠ |
| `validation-scenario-11.json` | J♣ 9♣ A♣ K♣ Q♣ 10♥ J♦ 8♦ | 100 ♣ |
| `validation-scenario-12.json` | J♠ 9♠ A♠ 7♠ A♥ Q♥ J♦ 10♣ | 110 ♠ |
| `validation-scenario-13.json` | J♣ 9♣ A♣ 10♣ A♠ K♠ A♥ 7♦ | 110 ♣ |
| `validation-scenario-14.json` | J♥ 9♥ A♥ K♥ A♣ 10♣ 9♣ 8♣ | 120 bicolore ♥ |
| `validation-scenario-15.json` | J♠ 9♠ A♠ K♠ Q♠ A♥ 10♥ 7♥ | 120 bicolore ♠ |
| `validation-scenario-16.json` | J♥ 9♥ A♥ K♥ A♣ 10♣ 9♣ 7♠ | 110 ♥ |
| `validation-scenario-17.json` | J♠ 9♠ A♠ 8♠ A♥ Q♥ J♦ 10♣ | 110 ♠ |
| `validation-scenario-18.json` | J♠ 9♠ 8♠ A♥ K♥ Q♥ 8♦ A♣ | 80 ♠ |
| `validation-scenario-19.json` | J♠ 9♠ 8♠ 7♠ J♥ K♥ Q♥ A♦ | 90 (couleur libre) |
| `validation-scenario-20.json` | J♠ 9♠ 8♠ J♥ 9♥ K♥ A♦ A♣ | 80 (couleur libre) |
