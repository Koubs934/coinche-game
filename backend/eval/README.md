# Behavioral eval — La Feuille bot

Measures the **real model behavior** (not prompt text) against the failure-mode
taxonomy in [`docs/tasks/eval-design-proposal.md`](../../docs/tasks/eval-design-proposal.md).
Complements the 74 static prompt-text tests, which only assert the guardrail text
*exists*.

## Run

```sh
cd backend
export $(cat .env.railway.local | xargs)   # ANTHROPIC_API_KEY
npm run eval                                # all cases, 3 samples each (default)
node eval/run.js --samples=5               # 5 samples/case (robust re-baseline)
node eval/run.js --only=HAL-1              # one case
node eval/run.js --only=2-hallucination   # one category
node eval/run.js --only=ANN-1,DER-1       # comma-separated subset of ids/categories
node eval/run.js --only=ANN-1 --no-judge  # éco: real bot + signals, NO Opus judge (dumps replies)
```

**Éco mode (`--no-judge`).** Runs the real production bot + deterministic signals
but skips the Opus judge entirely (no judging, no scorecard). It prints a dump of
each case's user-visible replies (CAPTURE_RULE stripped) with the
`questionsBeloteDame` signal per sample, and writes `results/eval-nojudge-*.json`.
For cheap iteration where a human judges the outputs.

Runs **outside** vitest / verify.js — on demand, **never a CI gate** (it makes
real API calls).

**Multi-sample.** The bot (sonnet-4-6, default temperature, no thinking) is
stochastic, so single-run pass/fail wobbles. Each case is run `--samples=N` times
(default 3) on the SAME seed/history/probe; the scorecard reports a per-case pass
count **k/N** and a class: **STABLE-PASS** (k=N), **STABLE-FAIL** (k=0),
**WOBBLE** (0<k<N), plus a mean-pass aggregate and a wobble-by-category callout
(flagging if over-validation cat 1 or hallucination cat 2 wobble). Samples run
sequentially within a case; ≤2 cases in parallel.

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
