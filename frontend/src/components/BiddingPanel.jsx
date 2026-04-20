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
