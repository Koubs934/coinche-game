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

  // Legal-bids-only: render only values the server would accept — every value
  // strictly greater than the current highest bid, plus Capot (opening = all of
  // 80…160 + Capot). Illegal values are never put in the DOM (no greyed chips).
  // isValidBid is the same predicate submitBid guards on, so the grid can never
  // offer a value the emit path would reject.
  const legalValues = BID_VALUES.filter(isValidBid);
  // Two rows, fill-then-stretch: top = ceil(N/2), bottom = floor(N/2); each row
  // flexes its chips full-width (no lonely left-aligned chip). Capot is just the
  // last value in the sequence — no special-casing.
  const splitAt = Math.ceil(legalValues.length / 2);
  const valueRows = [legalValues.slice(0, splitAt), legalValues.slice(splitAt)]
    .filter(row => row.length > 0);

  // Suit strip (option B): its own centered row between the value grid and the
  // action row. Shown whenever there are legal values to bid (a suit attaches to
  // every value, Capot included); hidden only when a surcoinche is the sole move.
  const showSuits = valueRows.length > 0 && !canSurcoinche;

  // Each value chip echoes the currently-selected trump inline (e.g. "130♦",
  // "Capot♦"). This is a pure DISPLAY mirror of `selectedSuit` — it never changes
  // the bid payload (submitBid already emits selectedSuit for every value, Capot
  // included). selectedSuit always has a default, so the glyph is normally shown;
  // the guard keeps it absent if a suit is ever cleared.
  const suitEcho = selectedSuit && (
    <span className={`bid-val-suit ${selectedSuit === 'H' || selectedSuit === 'D' ? 'red' : 'black'}`}>
      {t.suitSymbol[selectedSuit]}
    </span>
  );

  const renderVal = v => (
    <button
      key={v}
      className={`bid-val-btn${selectedValue === v ? ' selected' : ''}`}
      onClick={() => setSelectedValue(v)}
    >
      {v === 'capot' ? t.capot : v}{suitEcho}
    </button>
  );

  return (
    <div className="bidding-panel">
      {/* Value selector — legal bids only, two-row fill-then-stretch */}
      {valueRows.length > 0 && (
        <div className="bid-values">
          {valueRows.map((row, i) => (
            <div key={i} className="bid-values-row">{row.map(renderVal)}</div>
          ))}
        </div>
      )}

      {/* Suit strip — centered row of 4 chips between the values and the action
          row. The selected suit keeps the existing gold ring. */}
      {showSuits && (
        <div className="suit-chips">
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

      {/* Action row — clean, full-width controls, NO suit glyph. Annoncer is the
          single solid (amber) control; Passer is quiet; Coinche!/Surcoinche! are
          red outlines shown only when eligible. */}
      <div className="bid-action-row">
        {canSurcoinche ? (
          <button className="btn-surcoinche-outline" onClick={doSurcoinche}>{t.surcoinche}</button>
        ) : (
          <>
            <button className="btn-annoncer" onClick={submitBid} disabled={!selectedValue}>{t.bid}</button>
            {canCoinche && <button className="btn-coinche-outline" onClick={doCoinche}>{t.coinche}</button>}
          </>
        )}
        <button className="btn-passer" onClick={pass}>{t.pass}</button>
      </div>
    </div>
  );
}
