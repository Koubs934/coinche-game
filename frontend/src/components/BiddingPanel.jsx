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

  // Suits live on the action row; hidden when Capot is picked (no suit) or when
  // a surcoinche is the only move.
  const showSuits = selectedValue !== 'capot' && !canSurcoinche;

  const renderVal = v => (
    <button
      key={v}
      className={`bid-val-btn${selectedValue === v ? ' selected' : ''}`}
      onClick={() => setSelectedValue(v)}
    >
      {v === 'capot' ? t.capot : v}
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

      {/* Suits + actions on one row. Annoncer is the single solid (amber)
          control; Passer is quiet; Coinche!/Surcoinche! are red outlines shown
          only when eligible. */}
      <div className="bid-action-row">
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
