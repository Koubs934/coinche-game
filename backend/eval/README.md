# Behavioral eval — La Feuille bot

Measures the **real model behavior** (not prompt text) against the failure-mode
taxonomy in [`docs/tasks/eval-design-proposal.md`](../../docs/tasks/eval-design-proposal.md).
Complements the 74 static prompt-text tests, which only assert the guardrail text
*exists*.

## Run

```sh
cd backend
export $(cat .env.railway.local | xargs)   # ANTHROPIC_API_KEY
npm run eval                                # all cases
node eval/run.js --only=HAL-1              # one case
node eval/run.js --only=2-hallucination   # one category
```

Runs **outside** vitest / verify.js — on demand, **never a CI gate** (it makes
real API calls).

- **Bot under test** = the module's current config, automatically:
  `claude-sonnet-4-6`, `max_tokens 1024`, **no thinking** (the baseline). Change
  `MODEL` / add `thinking` in `services/claudeService.js`, re-run, compare.
- **Judge** = `claude-opus-4-8` (fixed across runs).
- It imports the **real** `startConversation` / `continueConversation` /
  `formatScenarioForClaude` / `buildSystemPrompt` and the refactored
  `loadFeuille` / `buildConversationHistory` — no copy of the prompt or assembly.

## Scoring (locked)

A case **PASSes** iff: every **blocking** deterministic check passes (banned
phrases, fabrications, capot/`exactement 2 As`/etc. forbids, length ≤ 4
sentences, French, and the cited-cell value when a number is cited) **and** the
judge (if any) returns PASS. Deterministic checks are the authority only to
**FORBID**; "did the bot do the required thing" is the **judge's** call. REQUIRE-
style regexes are shown as **signals** (informational), never scored. `leading /
cadrage` is observed-and-logged, never scored.

## Cases

Real cases reference a local annotation file under `backend/data/training/`
(**gitignored**) + a committed scenario in `src/training/scenarios/`. If the
annotation is absent the case **skips** with a warning. Synthetic cases inline
their seed over a committed scenario.

## Output

Timestamped `results/eval-<ISO>.{json,md}` + `results/latest.md`.
`results/` is gitignored. The `.md` shows, per case: the model's real output
verbatim, every check (blocking vs signal), the judge verdict + reason, the
leading flag, and tokens; it ends with a leading-frequency tally.
