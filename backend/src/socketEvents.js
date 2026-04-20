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
// All C→S events are rate-limited by server.js middleware (30/sec per socket).

// ─── S→C events ────────────────────────────────────────────────────────────
//   'roomJoined' : RoomSync
//   'roomUpdate' : RoomSync
//   'joinPending': { code }
//   'leftRoom'   : ()
//   'error'      : { message }   // including 'Too many requests — slow down' from rate limiter
//                                //           'beloteDecisionRequired' prompts the client modal

module.exports = {}; // no runtime exports — contract only
