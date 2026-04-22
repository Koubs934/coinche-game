/**
 * Socket.IO event contract — single source of truth for FE ↔ BE payloads.
 *
 * Runtime is a no-op export; this file exists so that every socket event used
 * in server.js has a documented payload shape. When you add, rename, or
 * reshape an event, update it here and in the frontend. JSDoc typedefs are
 * picked up by TypeScript-aware editors even though the code is plain JS.
 *
 * Naming:
 *   C→S  (client → server)  handled via socket.on in server.js
 *   S→C  (server → client)  emitted via socket.emit / broadcast
 *
 * All S→C room updates include the room-scoped state in this shape:
 *   { room: PublicRoom, game: PublicGame, myPosition: 0|1|2|3 }
 */

// ─── Shared types ──────────────────────────────────────────────────────────

/** @typedef {'S'|'H'|'D'|'C'} Suit */
/** @typedef {'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A'} CardValue */
/** @typedef {{ suit: Suit, value: CardValue }} Card */
/** @typedef {80|90|100|110|120|130|140|150|160|'capot'} BidValue */

/**
 * @typedef {Object} PublicPlayer
 * @property {string}  userId
 * @property {string}  username
 * @property {0|1}     team
 * @property {0|1|2|3} position
 * @property {boolean} connected
 * @property {boolean} isBot
 */

/**
 * @typedef {Object} PublicRoom
 * @property {string}         code
 * @property {string}         creatorId
 * @property {PublicPlayer[]} players
 * @property {number}         targetScore
 * @property {'LOBBY'|'SHUFFLE'|'CUT'|'PLAYING'|'ROUND_OVER'|'GAME_OVER'} phase
 * @property {[number,number]} scores
 * @property {boolean}        paused
 * @property {Array<{userId:string,username:string}>} pendingJoins
 * @property {string[]}       nextRoundReady
 * @property {number|null}    shuffleDealer
 * @property {number|null}    cutPlayer
 * @property {'shuffled'|'notShuffled'|'cut'|'notCut'|null} lastShuffleCutAction
 * @property {number|null}    lastShuffleCutActorPos
 * @property {boolean}        canUndo
 */

/**
 * @typedef {Object} PublicGame
 * Only the viewer's own hand is populated; other hands are nulls with
 * the right length (count via handCounts).
 * @property {string|null} gameId  // per-round UUID used by Game Review events
 * @property {Array<{annotationId:string,cardRef:{trickIndex:number,seat:number,card:string},note:string,createdAt:string,createdByUserId:string}>} errorAnnotations
 * @property {number}     dealer
 * @property {'BIDDING'|'PLAYING'|'ROUND_OVER'} phase
 * @property {{value:BidValue,suit:Suit,playerIndex:number,team:0|1,coinched:boolean,surcoinched:boolean}|null} currentBid
 * @property {number|null} biddingTurn
 * @property {number}     consecutivePasses
 * @property {Array<{type:'bid',value:BidValue,suit:Suit}|{type:'pass'}|{type:'coinche'}|{type:'surcoinche'}|null>} biddingActions
 * @property {Array}      biddingHistory
 * @property {Array<{cards:Array<{card:Card,playerIndex:number}>,winner:number}>} tricks
 * @property {Array<{card:Card,playerIndex:number}>} currentTrick
 * @property {number|null} currentPlayer
 * @property {Suit|null}   trumpSuit
 * @property {{playerIndex:number|null,declared:'yes'|'no'|null,rebeloteDone:boolean,complete:boolean,team:0|1|null}} beloteInfo
 * @property {[number,number]} roundScores
 * @property {boolean|null} contractMade
 * @property {[number,number]|null} trickPoints
 * @property {Array<Array<Card|null>>} hands
 * @property {number[]}   handCounts
 */

/** @typedef {{ room: PublicRoom, game: PublicGame|null, myPosition: 0|1|2|3 }} RoomSync */

// ─── Handshake ─────────────────────────────────────────────────────────────
// socket.handshake.auth: { userId: string, username: string }
// Rejected with Error('Authentication required') when either is missing.

// ─── C→S events ────────────────────────────────────────────────────────────
// Lobby:
//   'createRoom'    ()                                   → S→C 'roomJoined'
//   'joinRoom'      ({ code })                           → S→C 'roomJoined' | 'joinPending' | 'error'
//   'rejoinRoom'    ({ code })                           → S→C 'roomJoined' | 'joinPending' | 'leftRoom'
//   'leaveRoom'     ({ code })                           → S→C 'leftRoom' (+ broadcast)
//   'fillWithBots'  ({ code })
//   'assignTeam'    ({ code, targetUserId, team: 0|1 })
//   'setTargetScore'({ code, targetScore: number })
//   'startGame'     ({ code })
//   'acceptJoin'    ({ code, targetUserId })
//   'cancelJoinRequest'({ code })
//   'removePlayer'  ({ code, targetUserId })
//
// Bidding:
//   'placeBid'   ({ code, value: BidValue, suit: Suit })
//   'passBid'    ({ code })
//   'coinche'    ({ code })
//   'surcoinche' ({ code })
//
// Play:
//   'playCard'   ({ code, card: Card, declareBelote?: boolean })
//
// Shuffle/Cut:
//   'shuffleDeck'({ code })
//   'skipShuffle'({ code })
//   'cutDeck'    ({ code, n: 1..31 })
//   'skipCut'    ({ code })
//
// Round:
//   'confirmNextRound'({ code })
//
// Admin:
//   'undoLastAction'({ code })  // creator only
//
// Game Review (creator-only tagging during a live round):
//   'createGameErrorAnnotation' ({ gameId, cardRef:{trickIndex,seat,card}, note })
//     gameId routes to the active room holding the matching in-progress game.
//     cardRef identifies the card being flagged (trickIndex + seat are the
//     unique key; card string is cross-checked against what was actually played).
//     Server-side permission and validation errors:
//       FORBIDDEN_NOT_ROOM_CREATOR — socket.userId !== room.creatorId
//       UNKNOWN_GAME               — gameId does not match any active room
//       INVALID_CARD_REF           — trickIndex out of range, seat did not play
//                                    that trick, or card mismatch
//       NOTE_EMPTY                 — note is empty/whitespace-only
//       NOTE_TOO_LONG              — note exceeds 2000 chars
//     On success:
//       → S→C 'gameErrorAnnotationCreated' { gameId, annotation } (creator only)
//       → S→C 'roomUpdate' broadcast so publicGame.errorAnnotations stays synced
//
//   'getCurrentGameState' ({ gameId })
//     Requests a fresh snapshot of the game state keyed by gameId. Used by the
//     tag overlay to re-hydrate the trick/card grid without relying on a
//     reconnection. Responds on 'roomUpdate' (filtered to the requester).
//     Errors: UNKNOWN_GAME.
//
// All C→S events are rate-limited by server.js middleware (30/sec per socket).

// ─── S→C events ────────────────────────────────────────────────────────────
//   'roomJoined' : RoomSync
//   'roomUpdate' : RoomSync
//   'joinPending': { code }
//   'leftRoom'   : ()
//   'gameRecordSaved'          : { gameId, filePath }
//     Emitted to the room creator only, once per completed round, after the
//     GameRecord has been atomically written to disk. filePath is absolute
//     and useful for diagnostic logging only — do NOT show it in the UI.
//   'gameErrorAnnotationCreated': { gameId, annotation:{annotationId,cardRef,note,createdAt,createdByUserId} }
//     Emitted to the creator's socket after a successful createGameErrorAnnotation.
//   'error'      : { message, code? }
//                     code is an optional machine-readable sentinel — UI uses
//                     it to drive recovery flows without string-matching.
//                     Known codes:
//                       'UNKNOWN_TRAINING_RUN' — in-memory run not found for
//                         this socket; client should route to the picker and
//                         refresh resumable partials via getResumablePartials.
//                     Also: 'Too many requests — slow down' (rate limiter,
//                     no code yet); 'beloteDecisionRequired' (prompts modal).

// ─── Training mode ─────────────────────────────────────────────────────────
// Parallel subsystem — does not share state with normal rooms. Handlers live
// in backend/src/training/trainingSocket.js. Annotations are persisted to
// disk under backend/data/training/<userId>/; no Redis involvement.
//
// Shared shape for updates emitted during a run (same as RoomSync but with
// trainingState attached): { trainingState, room, game, myPosition }
//   trainingState = { runId, scenarioId,
//                     runState: 'SCRIPT-PLAYING'|'AWAITING-ACTION'|'AWAITING-REASON'|'COMPLETE',
//                     timelineCursor, totalSteps,
//                     pendingAction: {type,...}|null }
//
// Discovery (C→S):
//   'getTrainingTags'           ()
//     → S→C 'trainingTags'          { tags: <full reasonTags.json> }
//   'listTrainingScenarios'     ()
//     → S→C 'trainingScenariosList' { scenarios: [{id,title,description,userSeat,dealer}, ...] }
//   'getResumablePartials'      ()
//     Explicit refresh of the resumable-partials list. The same payload is
//     also emitted unsolicited on socket connect; this is for recovering
//     without a reconnect (e.g. after UNKNOWN_TRAINING_RUN).
//     → S→C 'trainingResumablePending' { partials }
//   'getTrainingScenario'       ({ scenarioId })
//     → S→C 'trainingScenario'      { scenario: <full scenario JSON> }
//
// Lifecycle (C→S):
//   'startTrainingScenario'     ({ scenarioId })
//     → S→C 'trainingStarted'       { ...trainingSync }            (initial snapshot)
//     then  'trainingUpdate'        { ...trainingSync }  — one per scripted event
//     then  'trainingUpdate'        { ...trainingSync, runState='AWAITING-ACTION' }
//
//   'submitTrainingAction'      ({ runId, action })
//     action = { type: 'bid',        value, suit }
//            | { type: 'pass' }
//            | { type: 'coinche' }
//            | { type: 'surcoinche' }
//            | { type: 'play-card',  card: {suit,value}, declareBelote?: boolean }
//     → S→C 'trainingAwaitingReason' { ...trainingSync, runState='AWAITING-REASON' }
//     (server writes partial annotation to disk atomically BEFORE emitting)
//
//   'submitTrainingReason'      ({ runId, tags: string[], note: string, ackWarnings?: boolean })
//     tags validated per action type against reasonTags.json. Validator is
//     declarative: groups flagged `requireExactlyOne` must have exactly one
//     selected tag; tags flagged `requiresNote` force a non-empty note.
//     Non-blocking warnings (e.g. `recommendAtLeastOne` groups like
//     trump-hand) bounce back via 'trainingReasonWarning' unless the client
//     resubmits with `ackWarnings: true` — see below.
//     → S→C 'trainingCompleted'     { runId, annotation:{scenarioId,startedAt,completedAt,decisions} }
//     (file rewritten with status='complete' before emitting)
//     → S→C 'trainingReasonWarning' { runId, tags, note, warnings:string[] }
//     (only when v.ok with warnings && !ackWarnings; nothing is written,
//     run stays in AWAITING-REASON)
//     After trainingCompleted, the server ALSO emits
//     'trainingScenarioReviewPrompt' so the client can prompt "Autre
//     stratégie possible ?" — see below.
//
//   'submitScenarioReviewAnswer'({ runId, sessionId, answer:'yes'|'no' })
//     Response to the review prompt. 'yes' resets the run to SCRIPT-PLAYING
//     for the next alternative on the same scenario (duplicate bids are
//     hard-refused via DUPLICATE_BID_IN_SESSION). 'no' concludes the
//     session, appends the scenario to <userId>/_exhausted.json, and GCs
//     the run.
//     → S→C 'trainingScenarioReviewed'   { ...trainingSync } (yes path)
//     → S→C 'trainingScenarioExhausted'  { runId, scenarioId, sessionId,
//                                          alternativesRecorded,
//                                          exhaustedScenarios } (no path)
//     Error codes:
//       UNKNOWN_SESSION — sessionId does not match the run's session
//
//   'getExhaustedScenarios'     ()
//     On-demand fetch of the user's exhausted list (the picker hides these
//     by default). Also auto-emitted via 'exhaustedScenarios' on connect.
//     → S→C 'exhaustedScenarios' { exhaustedScenarios:[{scenarioId,sessionId,exhaustedAt,alternativesRecorded}] }
//
//   'undoTrainingAction'        ({ runId })
//     Valid only in AWAITING-REASON. Restores the pre-action game-state
//     snapshot, deletes the partial from disk, transitions back to
//     AWAITING-ACTION so the user can re-play the decision.
//     → S→C 'trainingUpdate'         { ...trainingSync, runState='AWAITING-ACTION' }
//
//   'submitTrainingAction'      — also enforces DUPLICATE_BID_IN_SESSION
//     within an active exhaustion session (alternativeIndex > 0). Error code
//     is surfaced via the shared 'error' channel; the game-state mutation is
//     NEVER applied when this fires, so the server's run remains consistent.
//
//   'abandonTrainingScenario'   ({ runId })
//     → S→C 'trainingAbandoned'     { runId }
//     (any partial on disk is deleted; nothing persists)
//
//   'leaveTrainingSummary'      ({ runId })
//     (silent cleanup — user left the summary screen; run GC'd immediately)
//
// Resume flow (C→S):
//   On socket connect, if any awaiting-reason partials <30 min old exist
//   under the user's data dir, server emits:
//     S→C 'trainingResumablePending' { partials: [{partialId,scenarioId,startedAt,action,ageMs}, ...] }
//
//   'resumeTrainingScenario'    ({ partialId })
//     Server rehydrates the run in memory and transitions straight to
//     AWAITING-REASON with the saved action.
//     → S→C 'trainingAwaitingReason' { ...trainingSync, runState='AWAITING-REASON' }
//
//   'discardPartialTraining'    ({ partialId })
//     (silent success — file deleted)
//
// Disconnect policy:
//   5-min GC timer per in-memory run on socket drop. Reconnect within that
//   window and emitting any training event re-engages the run.
//   Partials on disk are independent of the timer.
//
// All training events are subject to the same 30/sec per-socket rate limit
// as normal-game events.

module.exports = {}; // no runtime exports — contract only
