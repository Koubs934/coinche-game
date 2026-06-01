# BIDDING_CONTEXT.md

Read-only inspection captured 2026-05-22 from branch `main`. The goal of this
document is to give whoever redesigns the BIDDING-phase mobile layout a single
place to copy-paste from: JSX render trees, the exact CSS that positions every
piece, viewport-unit usage, "Mode Delfino" wiring, and the i18n keys that the UI
reads. Everything below is VERBATIM from the source files — no rewording.

---

## 1. Component tree (bidding phase)

Entry point: `frontend/src/components/GameBoard.jsx`. During BIDDING the render
path is roughly:

```
.game-board (root)
├── .pending-joins-panel   (fixed; rendered only if room.pendingJoins)
├── .last-trick-overlay    (modal; only if showLastTrick)
├── .score-bars
│     ├── .total-score-bar (team0/team1 totals + target)
│     └── .live-score-bar  (only PLAYING — not shown during BIDDING)
├── .board-top
│     ├── ContractBadge / CoincheBadge (post-auction only)
│     └── <PlayerSeat direction="top" />     // partner (Bot 2)
├── .board-middle
│     ├── .board-left
│     │     └── <PlayerSeat direction="left" />   // left opponent
│     ├── .board-center
│     │     ├── .table-bid.tbid-top   <BidStack/>   // partner's bids (overlay)
│     │     ├── .table-bid.tbid-left  <BidStack/>   // left opponent's bids
│     │     ├── .table-bid.tbid-right <BidStack/>   // right opponent's bids
│     │     ├── .bid-center
│     │     │     ├── .bid-focal       (current highest bid)
│     │     │     └── .bid-whose-turn  ("À vous de jouer" or "▶ name")
│     │     └── (.scc-status etc. — shuffle/cut/banner stuff)
│     └── .board-right
│           └── <PlayerSeat direction="right" />  // right opponent
└── .board-hand
      ├── .your-turn-banner   (if isMyTurn)
      ├── .self-player-bar
      │     ├── .player-avatar
      │     ├── .self-name
      │     └── <BidStack/>   // self bid history (inline, not overlay)
      ├── <BiddingPanel/>     // ← only when phase==='BIDDING' && isMyBidTurn
      │     ├── .bid-values   (10-button grid: 80…160, Capot)
      │     ├── .suit-selector (4 suit buttons)
      │     └── .bid-action-row (Annoncer / Coinche / Passer)
      ├── .hand-toolbar
      │     ├── .btn-sort   (Trier)
      │     ├── .btn-undo   (Annuler — creator only)
      │     ├── .btn-manage (Gérer — creator only)
      │     └── .btn-leave  (Quitter)
      └── .my-hand           (the user's 8 cards)
```

### `GameBoard.jsx` — top of return / score bars / top seat
`frontend/src/components/GameBoard.jsx:452-534`

```jsx
  return (
    <div className="game-board">
      {showAdminPanel && isCreator && (
        <AdminPanel
          players={players} creatorId={room.creatorId} myUserId={myPlayer?.userId}
          phase={room.phase}
          onRemove={removePlayer} onClose={() => setShowAdminPanel(false)}
        />
      )}
      {paused && <PauseBanner players={players} t={t} />}

      {/* ── Pending join requests ───────────────────────────────────────────── */}
      {room.pendingJoins?.length > 0 && (
        <div className="pending-joins-panel">
          {/* …creator can accept; non-creator sees "waiting" label… */}
        </div>
      )}

      {/* ── Last trick viewer modal ─────────────────────────────────────── */}
      {showLastTrick && lastDoneTrick && (
        <div className="last-trick-overlay" onClick={() => setShowLastTrick(false)}>
          {/* …modal panel… */}
        </div>
      )}

      {/* ── Score bars ─────────────────────────────────────────────────────── */}
      <div className="score-bars">
        <div className="total-score-bar">
          <span className="tsb-item team0-col">{t.team1}: <strong>{scores[0]}</strong></span>
          <span className="tsb-target">/ {targetScore}</span>
          <span className="tsb-item team1-col">{t.team2}: <strong>{scores[1]}</strong></span>
        </div>
        {phase === 'PLAYING' && tricks?.length > 0 && (
          <div className="live-score-bar">
            <span className="lsb-label">{t.liveRound}:</span>
            <span className="team0-col"><strong>{livePoints[0]}</strong></span>
            <span className="lsb-sep">–</span>
            <span className="team1-col"><strong>{livePoints[1]}</strong></span>
          </div>
        )}
      </div>

      {/* ── Top seat (partner) ─────────────────────────────────────────────── */}
      <div className="board-top">
        {contractData && contractBy === (myPosition + 2) % 4 && (
          <ContractBadge contract={contractData} t={t} />
        )}
        {surcoincheBy === (myPosition + 2) % 4 && <CoincheBadge type="surcoinche" t={t} />}
        {coincheBy    === (myPosition + 2) % 4 && surcoincheBy !== (myPosition + 2) % 4 && <CoincheBadge type="coinche" t={t} />}
        <PlayerSeat {...seatData(2)} direction="top" isCreator={isCreator} onRemove={removePlayer} />
      </div>
```

### Middle row — left seat, center felt with bid bubbles, right seat
`frontend/src/components/GameBoard.jsx:536-676`

```jsx
      {/* ── Middle row ─────────────────────────────────────────────────────── */}
      <div className="board-middle">

        <div className="board-left">
          {contractData && contractBy === (myPosition + 3) % 4 && (
            <ContractBadge contract={contractData} t={t} />
          )}
          {surcoincheBy === (myPosition + 3) % 4 && <CoincheBadge type="surcoinche" t={t} />}
          {coincheBy    === (myPosition + 3) % 4 && surcoincheBy !== (myPosition + 3) % 4 && <CoincheBadge type="coinche" t={t} />}
          <PlayerSeat {...seatData(3)} direction="left" isCreator={isCreator} onRemove={removePlayer} />
        </div>

        <div className="board-center">
          {/* ── Table-positioned bid chips — float on table in front of each opponent ── */}
          {isBidding && perPlayerHistory[(myPosition + 2) % 4]?.length > 0 && (
            <div className="table-bid tbid-top">
              <BidStack history={perPlayerHistory[(myPosition + 2) % 4]} t={t} />
            </div>
          )}
          {isBidding && perPlayerHistory[(myPosition + 3) % 4]?.length > 0 && (
            <div className="table-bid tbid-left">
              <BidStack history={perPlayerHistory[(myPosition + 3) % 4]} t={t} />
            </div>
          )}
          {isBidding && perPlayerHistory[(myPosition + 1) % 4]?.length > 0 && (
            <div className="table-bid tbid-right">
              <BidStack history={perPlayerHistory[(myPosition + 1) % 4]} t={t} />
            </div>
          )}

          {/* Bidding center — focal bid + turn + history */}
          {phase === 'BIDDING' && (
            <div className="bid-center">
              {/* Focal element: current highest bid */}
              <div className="bid-focal">
                {currentBid ? (
                  <>
                    <span className="bid-focal-value">
                      {currentBid.value === 'capot' ? t.capot : currentBid.value}
                    </span>
                    {currentBid.suit && (
                      <span className={`bid-focal-suit${currentBid.suit === 'H' || currentBid.suit === 'D' ? ' red' : ''}`}>
                        {t.suitSymbol[currentBid.suit]}
                      </span>
                    )}
                    {currentBid.surcoinched && <span className="bid-focal-mod sur">{t.surcoinched}</span>}
                    {currentBid.coinched && !currentBid.surcoinched && <span className="bid-focal-mod coin">{t.coinched}</span>}
                  </>
                ) : (
                  <span className="bid-focal-empty">{t.biddingPhase}</span>
                )}
              </div>

              {/* Whose turn */}
              <div className={`bid-whose-turn${isMyBidTurn ? ' mine' : ''}`}>
                {isMyBidTurn
                  ? `▶ ${t.yourTurn}`
                  : `▶ ${players.find(p => p.position === biddingTurn)?.username || '?'}`
                }
              </div>

            </div>
          )}

          {/* …PLAYING-phase TrickDisplay + last-trick widget omitted here… */}

          {/* Belote / Rebelote announce banner */}
          {beloteAnnounce && (
            <div className={`belote-announce ba-${beloteAnnounce}`}>
              {beloteAnnounce === 'belote' ? t.belote : t.rebelote} !
            </div>
          )}

          {/* Shuffle / Cut action feedback — shown to all players */}
          {/* …scc-announce/scc-status omitted (not bidding) … */}
        </div>

        <div className="board-right">
          {contractData && contractBy === (myPosition + 1) % 4 && (
            <ContractBadge contract={contractData} t={t} />
          )}
          {surcoincheBy === (myPosition + 1) % 4 && <CoincheBadge type="surcoinche" t={t} />}
          {coincheBy    === (myPosition + 1) % 4 && surcoincheBy !== (myPosition + 1) % 4 && <CoincheBadge type="coinche" t={t} />}
          <PlayerSeat {...seatData(1)} direction="right" isCreator={isCreator} onRemove={removePlayer} />
        </div>
      </div>
```

### Board-hand — self bar, bidding panel, toolbar, hand
`frontend/src/components/GameBoard.jsx:678-810`

```jsx
      {/* ── My hand ────────────────────────────────────────────────────────── */}
      <div className={`board-hand${isMyTurn ? ' hand-my-turn' : ''}`}>

        {/* "Your turn" pulse banner */}
        {isMyTurn && (
          <div className="your-turn-banner">{t.yourTurn} ●</div>
        )}

        {/* Contract badge above self player bar when self won the auction */}
        {contractData && contractBy === myPosition && (
          <ContractBadge contract={contractData} t={t} />
        )}
        {surcoincheBy === myPosition && <CoincheBadge type="surcoinche" t={t} />}
        {coincheBy    === myPosition && surcoincheBy !== myPosition && <CoincheBadge type="coinche" t={t} />}

        {/* Self player bar: avatar + name + bid status */}
        <div className="self-player-bar">
          <div className={`player-avatar team${myTeam}-avatar`}>
            {myPlayer?.isBot ? '🤖' : (displayName(myPlayer, t)[0]?.toUpperCase() || '?')}
          </div>
          <span className="self-name">{displayName(myPlayer, t)}</span>
          {isBidding && perPlayerHistory[myPosition]?.length > 0 && (
            <BidStack history={perPlayerHistory[myPosition]} t={t} />
          )}
        </div>

        {/* Bidding controls — shown at the bottom during my bid turn */}
        {phase === 'BIDDING' && isMyBidTurn && (
          <BiddingPanel
            socket={socket} roomCode={roomCode}
            game={game} myPosition={myPosition} myTeam={myTeam}
            sortMode={sortMode}
            trainingMode={trainingMode}
          />
        )}

        {/* …SHUFFLE / CUT controls omitted (not bidding)… */}

        {/* Toolbar row: sort toggle + undo + admin manage + leave */}
        <div className="hand-toolbar">
          {!isShuffleCut && (
            <button
              className={`btn-sort${sortMode !== 'manual' ? ' sort-on' : ''}${sortMode === 'H' || sortMode === 'D' ? ' sort-red' : ''}`}
              onClick={cycleSortMode}
              title={t.sortHand}
            >
              {sortMode === 'manual'
                ? `⇅ ${t.sortManual}`
                : `${SUIT_SYM[sortMode]} ${t.sortHand}`}
            </button>
          )}
          {!trainingMode && isCreator && (phase === 'BIDDING' || phase === 'PLAYING') && (
            <button
              className="btn-undo"
              onClick={() => socket.emit('undoLastAction', { code: roomCode })}
              disabled={!room.canUndo}
              title={t.undoAction}
            >
              ↩ {t.undoAction}
            </button>
          )}
          {!trainingMode && isCreator && (
            <button className="btn-manage" onClick={() => setShowAdminPanel(true)} title={t.managePlayersTitle}>
              ⚙ {t.managePlayers}
            </button>
          )}
          {/* Game Review: only rendered for the room creator in live games. */}
          {!trainingMode && isCreator && phase === 'PLAYING' && (
            <button
              className="btn-tag-play-error"
              onClick={() => setTagErrorOpen(true)}
              title={t.button.tagPlayError}
            >
              ⚠ {t.button.tagPlayError}
            </button>
          )}
          <button className="btn-leave" onClick={leaveTable}>
            {trainingMode ? t.training.abandonLabel : t.leaveTable}
          </button>
        </div>

        <div
          className={`my-hand${sortMode === 'manual' ? ' my-hand-manual' : ''}`}
          ref={handElRef}
          onPointerDown={handleHandPointerDown}
          onPointerMove={handleHandPointerMove}
          onPointerUp={handleHandPointerUp}
          onPointerCancel={handleHandPointerCancel}
        >
          {animatedHand.map(card => (
            <CardFace
              key={cardKey(card)}
              card={card}
              onClick={() => { /* play-card with belote-prompt branch */ }}
              highlight={isMyCardTurn}
              disabled={!isMyCardTurn}
              isDragging={dragVisual != null && cardKey(card) === cardKey(manualHand[dragVisual.fromIdx])}
            />
          ))}
        </div>
      </div>
```

---

## 2. Seat & bid-bubble positioning

The four seats are in three different flex containers:

- **TOP seat (partner)** lives in `.board-top` — a separate row above `.board-middle`.
  It is a flex column (`align-items: center`).
- **LEFT / RIGHT opponents** live in `.board-left` / `.board-right` — fixed-width
  (86 px) flex columns *inside* `.board-middle`, vertically centered.
- **BOTTOM (self)** is not rendered as a `PlayerSeat`; the user's own info is in
  the `.self-player-bar` inside `.board-hand`.

The bid bubbles for the three opponents are NOT inside the seat boxes — they
are absolutely positioned overlays inside `.board-center` (the green felt
column). The self-bid stack is inline inside `.self-player-bar`.

### JSX — three opponent bid bubbles, inside `.board-center`
`frontend/src/components/GameBoard.jsx:548-564`

```jsx
        <div className="board-center">
          {/* ── Table-positioned bid chips — float on table in front of each opponent ── */}
          {isBidding && perPlayerHistory[(myPosition + 2) % 4]?.length > 0 && (
            <div className="table-bid tbid-top">
              <BidStack history={perPlayerHistory[(myPosition + 2) % 4]} t={t} />
            </div>
          )}
          {isBidding && perPlayerHistory[(myPosition + 3) % 4]?.length > 0 && (
            <div className="table-bid tbid-left">
              <BidStack history={perPlayerHistory[(myPosition + 3) % 4]} t={t} />
            </div>
          )}
          {isBidding && perPlayerHistory[(myPosition + 1) % 4]?.length > 0 && (
            <div className="table-bid tbid-right">
              <BidStack history={perPlayerHistory[(myPosition + 1) % 4]} t={t} />
            </div>
          )}
```

### Self bid stack — inline in `.self-player-bar`
`frontend/src/components/GameBoard.jsx:694-702`

```jsx
        <div className="self-player-bar">
          <div className={`player-avatar team${myTeam}-avatar`}>
            {myPlayer?.isBot ? '🤖' : (displayName(myPlayer, t)[0]?.toUpperCase() || '?')}
          </div>
          <span className="self-name">{displayName(myPlayer, t)}</span>
          {isBidding && perPlayerHistory[myPosition]?.length > 0 && (
            <BidStack history={perPlayerHistory[myPosition]} t={t} />
          )}
        </div>
```

### `BidStack` — the actual bubble (column flex of `.bsi` items)
`frontend/src/components/gameBoardParts.jsx:63-93`

```jsx
export function BidStack({ history, t }) {
  if (!history?.length) return null;
  const items = [...history].reverse();
  return (
    <div className="bid-stack">
      {items.map((action, i) => {
        const isLatest = i === 0;
        const isRed = action.suit === 'H' || action.suit === 'D';
        const label =
          action.type === 'pass'         ? t.pass
          : action.type === 'coinche'    ? t.coinche
          : action.type === 'surcoinche' ? t.surcoinche
          : action.value === 'capot'     ? t.capot
          : `${action.value}${SUIT_SYM[action.suit]}`;
        return (
          <span
            key={i}
            className={[
              'bsi',
              isLatest ? 'bsi-current' : 'bsi-older',
              `bsi-${action.type}`,
              isLatest && isRed ? 'bsi-red' : '',
            ].filter(Boolean).join(' ')}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
```

### Layout containers — `.game-board`, `.board-top`, `.board-middle`, sides, center
`frontend/src/App.css:343-367`

```css
/* ─── Game board ────────────────────────────────────────────────────────── */
.game-board {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--table);
  gap: 4px;
  padding: 4px;
}

/* (replaced by .score-bars / .total-score-bar / .live-score-bar below) */
.score-target-small { color: var(--muted); font-size: 0.85em; }

.board-top    { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.board-middle {
  display: flex;
  flex: 1;
  gap: 4px;
  min-height: 0;
}
.board-left   { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 86px; flex-shrink: 0; }
.board-right  { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 86px; flex-shrink: 0; }
.board-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; gap: 6px; position: relative; }
.board-middle { border-radius: 14px; background: radial-gradient(ellipse at center, #1e6b30 0%, #164f22 70%, #0f3a18 100%); }
```

### The four bid-bubble anchor rules (THIS is the answer to "why TOP renders BELOW the side bids")
`frontend/src/App.css:369-382`

```css
/* ─── Table-positioned bid chip overlays ────────────────────────────────── */
/* Float on the green table surface in front of each player, not in their seat */
.table-bid {
  position: absolute;
  z-index: 2;
  pointer-events: none;
  text-align: center;
}
/* Top player (partner) — top-center of the table */
.tbid-top   { top: 8px;   left: 50%; transform: translateX(-50%); }
/* Left opponent — left edge of center, vertically centered */
.tbid-left  { left: 6px;  top: 50%; transform: translateY(-50%); }
/* Right opponent — right edge of center, vertically centered */
.tbid-right { right: 6px; top: 50%; transform: translateY(-50%); }
```

Why the TOP bid appears BELOW the side bids on screen, even though `top: 8px` is
numerically smaller than `top: 50%`:

- `.tbid-top` is anchored 8 px from the TOP of `.board-center` (the green felt).
  But the partner's *seat* (avatar + name) lives in `.board-top`, which is a
  *separate row above* `.board-middle`. So the partner avatar is way up at the
  top of the screen, and the partner's bid bubble lands ~8 px inside the felt,
  i.e. clearly *below* its own avatar.
- `.tbid-left` and `.tbid-right` are anchored to `top: 50%` of `.board-center`
  with `translateY(-50%)`. That centers them on the vertical mid-line of the
  felt — which is roughly the same height as the LEFT/RIGHT opponent avatars
  (because `.board-left` and `.board-right` use `justify-content: center`).
- Net effect on a mobile screen where the felt is short: the TOP bid chip ends
  up only slightly above the side chips (sometimes visually *below* them once
  you account for the partner avatar drawing the eye to the very top of the
  page). It looks asymmetric because the partner-seat lives *outside* the felt,
  while side seats sit *next to* the felt.

### Per-seat CSS
`frontend/src/App.css:386-409`

```css
/* ─── Player seats ──────────────────────────────────────────────────────── */
.player-seat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border: 2px solid transparent;
  border-radius: 10px;
  background: rgba(0,0,0,0.18);
  padding: 2px 4px;
}
.player-seat.player-left, .player-seat.player-right {
  flex-direction: column;
}
.player-name {
  font-size: 0.7em;
  color: var(--muted);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}
.turn-dot { color: var(--success); }
```

### `BidStack` container + per-item sizing
`frontend/src/App.css:1422-1468`

```css
/* ─── Per-player bid stack near each seat (bidding phase) ───────────────── */
.bid-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  max-width: 100%;
}

/* Base item */
.bsi {
  display: block;
  border-radius: 3px;
  white-space: nowrap;
  line-height: 1.3;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Latest / current action — prominent */
.bsi.bsi-current {
  font-size: 1em;
  font-weight: 800;
  padding: 3px 7px;
  background: rgba(0,0,0,0.42);
  border-radius: 5px;
  letter-spacing: 0.01em;
}

/* Older / outbid actions — subtle */
.bsi.bsi-older {
  font-size: 0.55em;
  color: rgba(255,255,255,0.28);
  padding: 0 3px;
  font-weight: 500;
}

/* Current: bid colors (black suit = accent, red suit = red) */
.bsi.bsi-current.bsi-bid               { color: var(--accent); }
.bsi.bsi-current.bsi-bid.bsi-red       { color: var(--red); }
/* Current: pass — visible but quiet */
.bsi.bsi-current.bsi-pass              { color: rgba(255,255,255,0.38); font-weight: 500; font-size: 0.7em; }
/* Current: coinche / surcoinche */
.bsi.bsi-current.bsi-coinche           { color: #f88; }
.bsi.bsi-current.bsi-surcoinche        { color: #cc88ff; }
```

---

## 3. Opponent cards (face-down columns)

### JSX — `PlayerSeat`
`frontend/src/components/gameBoardParts.jsx:118-153`

```jsx
export function PlayerSeat({ player, handCount, isActive, isDimmed, direction, isCreator, onRemove }) {
  const { t } = useLang();
  const name = displayName(player, t);
  const initial = player?.isBot ? '🤖' : (name[0]?.toUpperCase() || '?');
  return (
    <div className={[
      'player-seat',
      `player-${direction}`,
      isActive  ? 'active-player' : '',
      isDimmed  ? 'seat-dimmed'   : '',
    ].filter(Boolean).join(' ')}>
      <div className={`player-avatar team${player?.team ?? 0}-avatar`}>
        {initial}
      </div>
      <div className="player-name">
        {name}
        {player && player.connected === false && !player.isScripted && <span className="dc-indicator"> ⚠</span>}
        {isActive && <span className="turn-dot"> ●</span>}
      </div>
      {isCreator && player && !player.connected && !player.isBot && !player.isScripted && (
        <button
          className="btn-remove-player"
          onClick={() => {
            if (window.confirm(t.removeConfirm(player.username))) onRemove(player.userId);
          }}
          title={t.removePlayer}
        >✕</button>
      )}
      <div className="face-down-cards">
        {Array.from({ length: handCount || 0 }).map((_, i) => (
          <CardBack key={i} small />
        ))}
      </div>
    </div>
  );
}
```

### `CardBack` primitive (small variant)
`frontend/src/components/gameBoardParts.jsx:25-27`

```jsx
export function CardBack({ small }) {
  return <div className={`card card-back${small ? ' card-small' : ''}`}>🂠</div>;
}
```

### CSS — face-down stack + small card back
`frontend/src/App.css:465-526` (relevant excerpts)

```css
.face-down-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: center;
  max-width: 160px;
}
.player-left  .face-down-cards,
.player-right .face-down-cards { max-width: 36px; flex-direction: column; }
```

```css
.card-back {
  background: #1a4080;
  color: rgba(255,255,255,0.15);
  font-size: 1.4em;
  border: 1px solid #2255aa;
  cursor: default;
}
.card-back.card-small {
  width: 16px;
  height: 24px;
  font-size: 0.5em;
  border-radius: 3px;
}
```

Notes:

- TOP seat's face-down stack is **horizontal** (default `flex-wrap: wrap` + no
  override). Max width 160 px.
- LEFT and RIGHT seats override to `flex-direction: column` with `max-width: 36px`,
  so cards stack VERTICALLY in a 36-px-wide column. With 8 small backs (24 px each
  + 2 px gaps) this column is ≈ 190 px tall + 30 px avatar + name ≈ ~230 px tall.
- The side seats are *flex items* of `.board-middle`, so that ~230 px height
  inflates `.board-middle`. Because `.game-board` has `overflow: hidden` and is
  itself `flex:1` of the app, when total content exceeds the viewport on short
  phones, `.board-middle` consumes the budget and `.board-hand` (which is
  `flex-shrink: 0`) keeps its size, but content positioned in the middle can
  visually crowd up against the bidding panel. This is the mechanism by which
  the opponent card columns end up overlapping / pushing the value-button row
  off-screen on tight portrait viewports — there is no z-index war; it's pure
  flex pressure under `overflow: hidden`.
- The side seats themselves anchor their card column inline next to the avatar
  (no absolute positioning). The 86-px `.board-left` / `.board-right` columns
  bookend the felt horizontally.

### Landscape override for sides — shrinks but doesn't move them
`frontend/src/App.css:1691-1696` (inside `@media (max-height: 500px)`)

```css
  /* ── Side seats ── */
  .player-name { max-width: 38px; font-size: 0.65em; }
  .card-back.card-small { width: 12px; height: 18px; }
  .player-left  .face-down-cards,
  .player-right .face-down-cards { gap: 1px; }
```

---

## 4. Bidding panel

### Full component
`frontend/src/components/BiddingPanel.jsx:1-118` (entire file)

```jsx
import { useState } from 'react';
import { useLang } from '../context/LanguageContext';

const BID_VALUES = [80, 90, 100, 110, 120, 130, 140, 150, 160, 'capot'];
const SUITS = ['S', 'H', 'D', 'C'];

export default function BiddingPanel({ socket, roomCode, game, myPosition, myTeam, sortMode, trainingMode }) {
  const { t } = useLang();
  const [selectedValue, setSelectedValue] = useState(null);
  // Default to the sort candidate suit when Trier is ON; fall back to 'H' otherwise.
  const [selectedSuit, setSelectedSuit] = useState(
    sortMode && sortMode !== 'manual' ? sortMode : 'H'
  );

  const isMyTurn = game.biddingTurn === myPosition;
  const currentBid = game.currentBid;
  const canCoinche = isMyTurn && currentBid && !currentBid.coinched && myTeam !== currentBid.team;
  const canSurcoinche = isMyTurn && currentBid?.coinched && !currentBid?.surcoinched && myTeam === currentBid.team;

  function isValidBid(value) {
    if (currentBid?.coinched) return false; // no new bids after coinche
    if (!currentBid) return value === 'capot' || value >= 80;
    if (currentBid.value === 'capot') return false;
    return value === 'capot' || value > currentBid.value;
  }

  // Training mode routes all actions through a single submitTrainingAction
  // emit with the typed action payload; normal mode uses the per-action
  // room-scoped events. Every other behaviour (validation, UI state) is
  // identical.
  function emitBid(value, suit) {
    if (trainingMode) {
      socket.emit('submitTrainingAction', { runId: trainingMode.runId, action: { type: 'bid', value, suit } });
    } else {
      socket.emit('placeBid', { code: roomCode, value, suit });
    }
  }

  function submitBid() {
    if (!selectedValue || !isValidBid(selectedValue)) return;
    emitBid(selectedValue, selectedSuit);
    setSelectedValue(null);
  }

  function pass() {
    if (trainingMode) {
      socket.emit('submitTrainingAction', { runId: trainingMode.runId, action: { type: 'pass' } });
    } else {
      socket.emit('passBid', { code: roomCode });
    }
  }

  function doCoinche() {
    if (trainingMode) {
      socket.emit('submitTrainingAction', { runId: trainingMode.runId, action: { type: 'coinche' } });
    } else {
      socket.emit('coinche', { code: roomCode });
    }
  }

  function doSurcoinche() {
    if (trainingMode) {
      socket.emit('submitTrainingAction', { runId: trainingMode.runId, action: { type: 'surcoinche' } });
    } else {
      socket.emit('surcoinche', { code: roomCode });
    }
  }

  if (!isMyTurn) return null;

  return (
    <div className="bidding-panel">
      {/* Value selector */}
      <div className="bid-values">
        {BID_VALUES.map(v => (
          <button
            key={v}
            className={`bid-val-btn${selectedValue === v ? ' selected' : ''}${!isValidBid(v) ? ' disabled' : ''}`}
            onClick={() => isValidBid(v) && setSelectedValue(v)}
            disabled={!isValidBid(v)}
          >
            {v === 'capot' ? t.capot : v}
          </button>
        ))}
      </div>

      {/* Suit selector — hidden when capot or surcoinche */}
      {selectedValue !== 'capot' && !canSurcoinche && (
        <div className="suit-selector">
          {SUITS.map(s => (
            <button
              key={s}
              className={`suit-btn ${s === 'H' || s === 'D' ? 'red' : 'black'}${selectedSuit === s ? ' selected' : ''}`}
              onClick={() => setSelectedSuit(s)}
            >
              {t.suitSymbol[s]}
            </button>
          ))}
        </div>
      )}

      {/* Action row: Announce / [Coinche] / Pass */}
      <div className="bid-action-row">
        {canSurcoinche ? (
          <button className="btn-surcoinche btn-action" onClick={doSurcoinche}>{t.surcoinche}</button>
        ) : canCoinche ? (
          <>
            <button className="btn-primary" onClick={submitBid} disabled={!selectedValue}>{t.bid}</button>
            <button className="btn-coinche btn-action" onClick={doCoinche}>{t.coinche}</button>
          </>
        ) : (
          <button className="btn-primary" onClick={submitBid} disabled={!selectedValue}>{t.bid}</button>
        )}
        <button className="btn-secondary" onClick={pass}>{t.pass}</button>
      </div>
    </div>
  );
}
```

### CSS — panel container + value grid + suit buttons + action row
`frontend/src/App.css:795-846`

```css
/* ─── Bidding panel (lives in board-hand, full-width bottom panel) ──────── */
.bidding-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0 4px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  margin-bottom: 2px;
}

.bid-values {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
}
.bid-val-btn {
  background: #2c3e50;
  color: var(--text);
  padding: 7px 4px;
  border-radius: 4px;
  font-size: 0.9em;
  text-align: center;
  min-height: 36px;
}
.bid-val-btn.selected { background: var(--accent); color: #1a1a1a; font-weight: bold; }
.bid-val-btn.disabled { opacity: 0.3; cursor: not-allowed; }
.bid-val-btn:not(.disabled):hover { background: #3a4f65; }
.bid-val-btn.selected:hover { background: var(--accent); }

.suit-selector {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.suit-btn {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  font-size: 1.4em;
  background: #2c3e50;
}
.suit-btn.red  { color: var(--red); }
.suit-btn.black { color: #e0e0e0; }
.suit-btn.selected { outline: 2px solid var(--accent); }
.suit-btn:hover:not(.selected) { background: #3a4f65; }

.bid-action-row {
  display: flex;
  gap: 8px;
}
.bid-action-row > button { flex: 1; }
```

### Action-row button styles
`frontend/src/App.css:119-168`

```css
.btn-primary {
  background: var(--accent);
  color: #1a1a1a;
  padding: 10px 20px;
  border-radius: var(--radius);
  font-weight: bold;
  transition: opacity 0.15s;
}
.btn-primary:hover:not(:disabled) { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-secondary {
  background: #2c3e50;
  color: var(--text);
  padding: 10px 20px;
  border-radius: var(--radius);
  font-weight: bold;
}
.btn-secondary:hover { background: #3a4f65; }
…
.btn-coinche {
  background: #8b1a1a;
  color: #fff;
  padding: 7px 12px;
  border-radius: var(--radius);
  font-weight: bold;
  font-size: 0.9em;
}
.btn-coinche:hover { background: #a52020; }
.btn-surcoinche {
  background: #5a0a8a;
  color: #fff;
  padding: 7px 12px;
  border-radius: var(--radius);
  font-weight: bold;
  font-size: 0.9em;
}
.btn-surcoinche:hover { background: #6d0faa; }
```

### Landscape override — values switch to 10 columns
`frontend/src/App.css:1716-1724`

```css
  /* ── Bidding: 10 values in one row in the hand strip ── */
  .bidding-panel  { padding: 2px 0; gap: 3px; border-bottom: none; margin-bottom: 0; }
  .bid-values     { grid-template-columns: repeat(10, 1fr); gap: 2px; }
  .bid-val-btn    { min-height: 22px; padding: 2px 1px; font-size: 0.75em; }
  .suit-selector  { gap: 4px; }
  .suit-btn       { width: 28px; height: 28px; font-size: 1em; }
  .btn-coinche,
  .btn-surcoinche { padding: 3px 8px; font-size: 0.8em; }
  .bid-action-row { gap: 4px; }
  .bid-action-row > button { padding: 4px 8px; }
```

### Z-index / overlap behaviour

- `.bidding-panel` and its descendants **declare no `z-index`** and are
  **normal-flow** (not absolute / not fixed). They sit inside `.board-hand`,
  which is the last flex child of `.game-board`.
- The only absolutely-positioned thing in the bidding region is `.table-bid`
  (`position: absolute; z-index: 2;` — see §2), and that lives inside
  `.board-center`, NOT inside `.board-hand`.
- So the opponent card-back columns DO NOT overlap the value buttons via
  z-index. The mechanism is layout pressure: `.game-board { overflow: hidden }`
  + `.board-middle { flex: 1 }` + 8 stacked `card-back.card-small` (24 px each)
  in `.player-left/right .face-down-cards` make `.board-middle` consume so much
  vertical space on short phones that `.board-hand` (which is `flex-shrink: 0`
  with the bidding panel inside it) gets clipped at the bottom of the viewport.
  120 / Capot — the bottom row of `.bid-values` — is the first thing to fall
  off-screen.
- The value grid is `repeat(5, 1fr)` in portrait, meaning the 10 buttons render
  as a 5×2 grid, so the 120/Capot row is the *second* (bottom) row. In landscape
  this becomes `repeat(10, 1fr)` — a single row — which is why the problem only
  manifests in portrait.

---

## 5. Layout container & viewport units

### `index.html` viewport meta
`frontend/index.html:5`

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
```

### `html`, `body`, `#root` use percent height — **NOT `vh`/`dvh`/`svh`**
`frontend/src/App.css:24-33`

```css
html, body { height: 100%; overflow: hidden; }
body {
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--table);
  color: var(--text);
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
}

#root { height: 100%; }
```

### `.app` shell — flex column rooted in `100%` height
`frontend/src/App.css:41-48`

```css
/* ─── App shell ────────────────────────────────────────────────────────── */
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 600px;
  margin: 0 auto;
}
```

### `.game-board` — flex:1 inside `.app`, clips overflow
`frontend/src/App.css:344-352`

```css
.game-board {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--table);
  gap: 4px;
  padding: 4px;
}
```

### `vh` / `dvh` / `svh` audit

Search hits for `vh|dvh|svh|100vh|safe-area-inset` across `frontend/src`:

```
App.css:172   .auth-container { min-height: 100vh; … }              ← auth screen
App.css:178   .auth-container { padding-bottom: max(16px, env(safe-area-inset-bottom)); }
App.css:250   .lobby          { padding-bottom: max(16px, env(safe-area-inset-bottom)); }
App.css:384   .board-hand     { padding: 6px 4px max(6px, env(safe-area-inset-bottom)); }
App.css:1728  @media(max-height:500px) .board-hand { padding: 2px 4px max(2px, env(safe-area-inset-bottom)); }
App.css:1979  .training-tile-card / picker — min-height: 100vh        (NOT the game board)
App.css:2162  max-height: 50vh                                         (modal max)
App.css:2239  .training-flow padding-bottom: max(16px, env(safe-area-inset-bottom));
App.css:2493  max-height: calc(100vh - 32px)                           (some other modal)
```

Findings:

- The **game board itself does NOT use `vh`/`dvh`/`svh` at all** for sizing.
  It chains `height: 100%` from `html`/`body`/`#root`/`.app` and uses
  `flex: 1` on `.game-board` and `.board-middle`. So the layout never sees the
  iOS Safari address-bar trick that `vh` triggers.
- `100vh` is only used outside the game board: `.auth-container` (sign-in
  screen) and the training-picker tiles.
- No `dvh` or `svh` (dynamic / small viewport units) anywhere in the codebase.
  Mobile browsers' dynamic bottom bars are handled exclusively via
  `env(safe-area-inset-bottom)` padding on `.board-hand`, `.auth-container`,
  `.lobby`, and one training screen.
- The portrait viewport budget is therefore: app-header + score-bars +
  board-top + board-middle (flex:1) + board-hand, all inside `height: 100%`,
  with `overflow: hidden`. Whatever doesn't fit gets clipped at the bottom.

---

## 6. Mode Delfino

### Full grep output
```
$ grep -rn -i "delfino\|delphino" frontend/src backend/src

C:/Users/Aaron/Projects/coinche-game/frontend/src/App.css:537:/* Mode Delfino — user-toggled scale of the user's own hand cards.
C:/Users/Aaron/Projects/coinche-game/frontend/src/App.css:553:/* Toggle button itself (Mode Delfino) */
C:/Users/Aaron/Projects/coinche-game/frontend/src/components/HandSizeToggle.jsx:38:      aria-label="Mode Delfino — agrandir les cartes"
C:/Users/Aaron/Projects/coinche-game/frontend/src/components/HandSizeToggle.jsx:39:      title="Mode Delfino — agrandir les cartes"
C:/Users/Aaron/Projects/coinche-game/frontend/src/components/HandSizeToggle.jsx:42:      <span className="hand-size-toggle-label">Mode Delfino</span>
```

> Backend hits: **none**. "Mode Delfino" is a pure frontend, client-only UI
> preference. It is never sent to the server.

### State storage — `useHandCardSize` hook
`frontend/src/components/HandSizeToggle.jsx:1-46` (entire file)

```jsx
import { useState, useEffect } from 'react';

const SIZES = ['S', 'M', 'L'];
const STORAGE_KEY = 'coinche-hand-card-size';

export function useHandCardSize() {
  const [size, setSize] = useState(() => {
    if (typeof window === 'undefined') return 'S';
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return SIZES.includes(saved) ? saved : 'S';
    } catch {
      return 'S';
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, size);
    } catch {
      // localStorage may be unavailable (private mode, quota); ignore.
    }
  }, [size]);

  const cycle = () => {
    setSize(prev => SIZES[(SIZES.indexOf(prev) + 1) % SIZES.length]);
  };

  return { size, cycle };
}

export default function HandSizeToggle({ onCycle }) {
  return (
    <button
      type="button"
      className="hand-size-toggle"
      onClick={onCycle}
      aria-label="Mode Delfino — agrandir les cartes"
      title="Mode Delfino — agrandir les cartes"
    >
      <span className="hand-size-toggle-icon" aria-hidden="true">🧐</span>
      <span className="hand-size-toggle-label">Mode Delfino</span>
    </button>
  );
}
```

Persisted to `localStorage` under the key `coinche-hand-card-size` with values
`S` | `M` | `L`. Cycles S → M → L → S on tap.

### Where the state lives — `App.jsx`
`frontend/src/App.jsx:14-15`, `:44`

```jsx
import EnvBadge from './components/EnvBadge';
import { useHandCardSize } from './components/HandSizeToggle';
```

```jsx
export default function App() {
  const { user, username, loading } = useAuth();
  const { lang, toggleLang, t } = useLang();
  const { size: handSize, cycle: cycleHandSize } = useHandCardSize();
```

### How the state reaches the DOM — `data-hand-size` on `.app`
`frontend/src/App.jsx:398-454`

```jsx
  if (inTraining) {
    return (
      <div className="app" data-hand-size={handSize}>
        …
        {trainingView === 'run' && trainingRun && (
          <TrainingTable
            socket={socketRef.current}
            runId={trainingRun.trainingState.runId}
            room={trainingRun.room}
            game={trainingRun.game}
            myPosition={trainingRun.myPosition}
            trainingState={trainingRun.trainingState}
            onCycleHandSize={cycleHandSize}
          />
        )}
        …
        <EnvBadge />
      </div>
    );
  }

  return (
    <div className="app" data-hand-size={handSize}>
      <Header
        roomCode={roomState?.code}
        scores={roomState?.scores}
        targetScore={roomState?.targetScore}
        onCycleHandSize={cycleHandSize}
      />
      …
    </div>
  );
```

### Header — renders the toggle button
`frontend/src/components/Header.jsx:30-33`

```jsx
      <div className="app-header-row">
        <div className="app-header-row-left">
          {onCycleHandSize && <HandSizeToggle onCycle={onCycleHandSize} />}
        </div>
```

### What the toggle actually changes in the UI — *only* `.my-hand .card-face`
`frontend/src/App.css:537-572`

```css
/* Mode Delfino — user-toggled scale of the user's own hand cards.
   Only `.my-hand .card-face` (the playable hand at the bottom) is targeted;
   opponent backs (.card-small), trick cards (.trick-card) and AuctionRecap
   minis (.hand-strip-card / .ar-table-felt-card) are unaffected. */
:root { --hand-card-scale: 1; }
[data-hand-size="S"] { --hand-card-scale: 1; }
[data-hand-size="M"] { --hand-card-scale: 1.3; }
[data-hand-size="L"] { --hand-card-scale: 1.6; }

.my-hand .card-face {
  width: calc(var(--card-w) * var(--hand-card-scale));
  height: calc(var(--card-h) * var(--hand-card-scale));
  font-size: calc(0.85em * var(--hand-card-scale));
  transition: width 0.15s ease-out, height 0.15s ease-out, font-size 0.15s ease-out;
}

/* Toggle button itself (Mode Delfino) */
.hand-size-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: var(--text, #fff);
  font-size: 0.85em;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
  min-height: 32px;
}
.hand-size-toggle:hover,
.hand-size-toggle:focus-visible { background: rgba(255, 255, 255, 0.1); }
.hand-size-toggle-icon  { font-size: 1em; line-height: 1; }
.hand-size-toggle-label { white-space: nowrap; }
```

### What Mode Delfino does NOT change

There are **no JSX conditional branches** on the Delfino state — `grep` finds
no `{delfino && …}` / `{!delfino && …}` / ternary branches. The toggle changes
exactly one thing: the `--hand-card-scale` custom property on `.app`, scoped
via the `[data-hand-size="…"]` attribute selector. That property is consumed by
**only** the `.my-hand .card-face` rule (the user's own playable hand). Per the
comment in App.css:537-540, it is intentionally NOT applied to:

- opponent face-down backs (`.card-small`)
- trick cards (`.trick-card`)
- auction-recap minis (`.hand-strip-card`, `.ar-table-felt-card`)

So during BIDDING phase, "Mode Delfino" affects the user's own 8-card hand
displayed below the bidding panel. The bidding panel buttons themselves
(`.bid-val-btn`, `.suit-btn`), the opponent bid bubbles, and everything else
are size-independent.

### Toggle handler — `cycle`
Defined in `useHandCardSize` (see above) — pure local state setter. No socket
emit, no API call, no server round-trip.

---

## 7. i18n keys used in the bidding UI

All keys are sourced from `frontend/src/i18n/fr.js` (and mirrored in `en.js`).
They are accessed via `useLang()` → `t.<key>`. Below is the list — copy these
keys verbatim so any layout change keeps the right text:

### Bid values & suits

| Key                       | Value (fr)                                 | Used in            |
|---------------------------|---------------------------------------------|--------------------|
| `t.capot`                 | `'Capot'`                                  | bid-val-btn, bid-focal, BidStack |
| `t.suitSymbol.S`          | `'♠'`                                       | suit-btn, bid-focal-suit |
| `t.suitSymbol.H`          | `'♥'`                                       | suit-btn, bid-focal-suit |
| `t.suitSymbol.D`          | `'♦'`                                       | suit-btn, bid-focal-suit |
| `t.suitSymbol.C`          | `'♣'`                                       | suit-btn, bid-focal-suit |
| `t.suitName.S/H/D/C`      | `'Pique' / 'Cœur' / 'Carreau' / 'Trèfle'`   | not used in bidding panel itself (kept for completeness) |

### Bidding actions / labels

| Key                | Value (fr)            | Where rendered |
|--------------------|------------------------|----------------|
| `t.bid`            | `'Annoncer'`           | `btn-primary` Annoncer button |
| `t.pass`           | `'Passer'`             | `btn-secondary` Passer button + BidStack pass label |
| `t.coinche`        | `'Coinche !'`          | `btn-coinche` button + BidStack |
| `t.surcoinche`     | `'Surcoinche !'`       | `btn-surcoinche` button + BidStack |
| `t.coinched`       | `'Coinché'`            | `bid-focal-mod.coin` |
| `t.surcoinched`    | `'Surcoinché'`         | `bid-focal-mod.sur` |
| `t.biddingPhase`   | `'Annonces'`           | empty-state inside `.bid-focal` |
| `t.yourTurn`       | `'À vous de jouer'`    | `.bid-whose-turn.mine` + `.your-turn-banner` |
| `t.waitingFor(name)` | `` `En attente de ${name}...` `` | non-bidding turn text |

### Toolbar (live alongside the bidding panel)

| Key                       | Value (fr)            | Where |
|---------------------------|------------------------|-------|
| `t.sortHand`              | `'Trier'`              | `.btn-sort` label |
| `t.sortManual`            | `'Manuel'`             | `.btn-sort` (when sortMode === 'manual') |
| `t.undoAction`            | `'Annuler'`            | `.btn-undo` |
| `t.managePlayers`         | `'Gérer'`              | `.btn-manage` |
| `t.managePlayersTitle`    | `'Gérer les joueurs'`  | `.btn-manage` `title` attr |
| `t.leaveTable`            | `'Quitter la table'`   | `.btn-leave` |
| `t.training.abandonLabel` | `'Abandonner'`         | `.btn-leave` (training mode only) |
| `t.button.tagPlayError`   | `'Erreur de jeu'`      | `.btn-tag-play-error` (PLAYING only) |

### Header / scores (visible during BIDDING)

| Key                | Value (fr)            | Where |
|--------------------|------------------------|-------|
| `t.team1`          | `'Équipe 1'`           | `.total-score-bar` |
| `t.team2`          | `'Équipe 2'`           | `.total-score-bar` |
| `t.liveRound`      | `'Pli en cours'`       | `.live-score-bar` (PLAYING only — not BIDDING) |

### Removal / disconnect (rarely shown during BIDDING but rendered by `PlayerSeat`)

| Key                       | Value (fr) |
|---------------------------|------------|
| `t.removePlayer`          | `'Retirer'` |
| `t.removeConfirm(name)`   | `` `Retirer ${name} ? La partie sera en pause jusqu'à ce qu'un joueur prenne sa place.` `` |
| `t.leaveConfirmGame`      | `'Quitter la table ? La partie sera mise en pause…'` |

### Belote / Rebelote announce banner (overlay can ride over `.board-center`)

| Key            | Value (fr)   |
|----------------|--------------|
| `t.belote`     | `'Belote'`   |
| `t.rebelote`   | `'Rebelote'` |

### Mode Delfino strings (NOT i18n — hardcoded French in `HandSizeToggle.jsx`)

| String                                        | Where           |
|-----------------------------------------------|-----------------|
| `'Mode Delfino — agrandir les cartes'`        | `aria-label`, `title` of `.hand-size-toggle` |
| `'Mode Delfino'`                              | `.hand-size-toggle-label` |
| `'🧐'`                                         | `.hand-size-toggle-icon` |

If the layout redesign needs to translate or relocate the toggle, those strings
live inline in `frontend/src/components/HandSizeToggle.jsx:38-42` — not in
`fr.js` / `en.js`. They have **no i18n keys** today.
