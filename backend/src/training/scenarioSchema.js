/**
 * Training-mode scenario schema — V1.
 *
 * Scenarios live as JSON files under backend/src/training/scenarios/<id>.json.
 * This module is documentation only; it exports nothing at runtime. When you
 * change the schema, bump `schemaVersion` here AND in every scenario file,
 * and update this doc.
 *
 * ─── V1 CONSTRAINTS ───────────────────────────────────────────────────────
 *
 * 1. Single-decision scenarios only. The `timeline` contains at most one
 *    `user-turn` event, and it MUST be the final event. The scenario ends
 *    immediately after the user's action + reason is captured.
 *
 *    Rationale: multi-decision timelines require branching-response logic
 *    for scripted seats (what does scripted seat 2 do if the user bid 90
 *    vs passed?). We are deferring that. If a future scenario needs multiple
 *    user decisions, extend the format with an explicit versioned revision.
 *
 * 2. Scripted seats are NOT driven by botLogic / botBidding. Their actions
 *    come entirely from the timeline. This is deliberate — the point of
 *    training mode is to control the auction context exactly.
 *
 * 3. The runner consumes scenarios top-down: emit each non-user event in
 *    order, then pause on `user-turn` until the frontend submits the user
 *    action + reason. Then end the scenario.
 *
 * ─── FILE SHAPE ───────────────────────────────────────────────────────────
 *
 *   {
 *     "schemaVersion":  1,
 *     "id":             "kebab-case unique id, matches filename without .json",
 *     "title":          { "fr": "...", "en": "..." },
 *     "description":    { "fr": "...", "en": "..." },
 *     "notes":          { "fr": "...", "en": "..." },
 *
 *     "userSeat":       0 | 1 | 2 | 3,
 *     "dealer":         0 | 1 | 2 | 3,
 *
 *     "hands": {
 *       "0": [ { "suit": "S|H|D|C", "value": "7|8|9|10|J|Q|K|A" }, ... 8 cards ],
 *       "1": [ ... 8 cards ],
 *       "2": [ ... 8 cards ],
 *       "3": [ ... 8 cards ]
 *     },
 *
 *     "initialState": {                    // optional; defaults to {phase: "BIDDING"}
 *       "phase":      "BIDDING" | "PLAYING",
 *       "trumpSuit":  "S|H|D|C",           // required when phase="PLAYING"
 *       "currentBid": {                    // required when phase="PLAYING"
 *         "value": 80|90|100|110|120|130|140|150|160|"capot",
 *         "suit":  "S|H|D|C",
 *         "playerIndex": 0|1|2|3,
 *         "team":  0|1,
 *         "coinched":    boolean,
 *         "surcoinched": boolean
 *       }
 *     },
 *
 *     "playbackSpeed": "normal" | "instant",   // optional, default "normal"
 *       //   "normal"  = 300 ms per scripted event (runner-side)
 *       //   "instant" = 0 ms; use for scenarios where the auction state is the
 *       //               point and step-by-step replay adds nothing.
 *
 *     "timeline": [
 *       // Non-user events (scripted). Emitted in order by the runner.
 *       { "event": "bid",        "seat": 0-3, "value": 80..160|"capot", "suit": "S|H|D|C", "authorIntent": "..." },
 *       { "event": "pass",       "seat": 0-3, "authorIntent": "..." },
 *       { "event": "coinche",    "seat": 0-3, "authorIntent": "..." },
 *       { "event": "surcoinche", "seat": 0-3, "authorIntent": "..." },
 *       { "event": "play-card",  "seat": 0-3, "card": {"suit","value"}, "declareBelote": boolean, "authorIntent": "..." },
 *
 *       // Exactly one, at the end. No events after this in V1.
 *       { "event": "user-turn" }
 *     ]
 *   }
 *
 * ─── FIELDS ───────────────────────────────────────────────────────────────
 *
 * `userSeat` — Which of the 4 seats the human plays. Teams: 0 & 2 vs 1 & 3.
 * `dealer`   — Seat that dealt. Bidding order starts at (dealer + 1) % 4.
 * `hands`    — Exact hands for all 4 seats. The full 32-card deck must be
 *              covered exactly once across the four hands (validator enforces).
 * `initialState` — Optional. Future-proofs card-play scenarios. Omit for the
 *              common case (new auction, BIDDING phase, no current bid).
 *
 * `timeline[].authorIntent` — Scenario author's note for why this scripted
 *              seat makes this move. STORED IN THE SCENARIO FILE. This is
 *              distinct from player annotations (reasons for the user's
 *              action), which live in backend/data/training/<user>/<run>.json.
 *
 * ─── ANNOTATION OUTPUT (reference, not part of this schema) ───────────────
 *
 * One file per run, written on scenario completion:
 *   backend/data/training/<userId>/<isoTimestamp>-<scenarioId>.json
 *
 *   {
 *     "schemaVersion":         1,
 *     "scenarioId":            "...",
 *     "scenarioSchemaVersion": 1,   // from scenario file
 *     "tagsSchemaVersion":     1,   // from reasonTags.json
 *     "userId":                "...",
 *     "username":              "...",         // snapshot; userId is authoritative
 *     "startedAt":             "ISO 8601",
 *     "completedAt":           "ISO 8601 | null while status !== complete",
 *     "status":                "awaiting-reason" | "complete" | "abandoned-partial",
 *     "decisions": [
 *       {
 *         "index":        0,
 *         "timelineStep": N,              // which step of the scenario timeline
 *         "phase":        "BIDDING" | "PLAYING",
 *         "action":       { "type": "bid|pass|coinche|surcoinche|play-card", ... },
 *         "tags":         ["key-1", "key-2"] | null,   // null while status="awaiting-reason"
 *         "note":         "..."            | null,     // null while status="awaiting-reason"
 *         "decidedAt":    "ISO 8601"       | null      // null while status="awaiting-reason"
 *       }
 *     ]
 *   }
 *
 * Lifecycle:
 *   1. User submits action                → file written with status="awaiting-reason"
 *                                           decisions[*].tags/note/decidedAt are null
 *   2. User submits reason                → same path rewritten with status="complete"
 *                                           completedAt set, tags/note/decidedAt filled
 *   3. Server restarts with a partial
 *      older than 30 minutes              → file rewritten with status="abandoned-partial"
 *                                           file is kept for later analysis
 *   All writes are atomic: write to <path>.tmp, fs.renameSync to <path>.
 */

module.exports = {}; // no runtime exports — schema docs only
