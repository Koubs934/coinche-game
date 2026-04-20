# Scenario Backlog

Scenarios identified during earlier design work but not yet authored. File them here so the probes aren't forgotten between batches. When authoring, move the entry into an actual `<id>.json` under this directory and delete it from the list.

---

## Pending

### `petit-jeu-in-different-suit-than-partner-info-80`
Partner opens 80♠ informative; user holds a Pattern A petit-jeu in a **different** suit (not ♠).

**Probes:** support-vs-switch as a distinct *action*, not distinct *reasoning* for the same action. Scenario 3 already covers the overlap case (same-suit → 90♠ either way, different tag reveals the reasoning). This variant distinguishes it by making the bid itself different depending on which reasoning wins — partner-suit bid (supporting-partner) vs user-suit bid (switching-to-own-suit).

**Hand constraint:** user's petit-jeu must be in a suit strictly other than ♠. Partner's info-80 shape stays the same (2+ Aces, ♠ highest trumpPtsSum). Both scenarios (this and `petit-jeu-after-partner-80-spades`) matter; don't collapse them into one.
