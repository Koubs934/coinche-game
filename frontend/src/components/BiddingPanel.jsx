import { useState } from 'react';
import { useLang } from '../context/LanguageContext';

const BID_VALUES = [80, 90, 100, 110, 120, 130, 140, 150, 160, 'capot'];
const SUITS = ['S', 'H', 'D', 'C'];

export default function BiddingPanel({ socket, roomCode, game, myPosition, myTeam }) {
  const { t } = useLang();
  const [selectedValue, setSelectedValue] = useState(null);
  const [selectedSuit, setSelectedSuit] = useState('H');

  const isMyTurn = game.biddingTurn === myPosition;
  const currentBid = game.currentBid;
  const myBidTeam = currentBid ? myTeam === currentBid.team : false;
  const canCoinche = isMyTurn && currentBid && !currentBid.coinched && myTeam !== currentBid.team;
  const canSurcoinche = isMyTurn && currentBid?.coinched && !currentBid?.surcoinched && myTeam === currentBid.team;

  function isValidBid(value) {
    if (currentBid?.coinched) return false; // no new bids after coinche
    if (!currentBid) return value === 'capot' || value >= 80;
    if (currentBid.value === 'capot') return false;
    return value === 'capot' || value > currentBid.value;
  }

  function submitBid() {
    if (!selectedValue || !isValidBid(selectedValue)) return;
    socket.emit('placeBid', { code: roomCode, value: selectedValue, suit: selectedSuit });
    setSelectedValue(null);
  }

  function pass() {
    socket.emit('passBid', { code: roomCode });
  }

  function doCoinche() {
    socket.emit('coinche', { code: roomCode });
  }

  function doSurcoinche() {
    socket.emit('surcoinche', { code: roomCode });
  }

  return (
    <div className="bidding-panel">
      {/* Current bid display */}
      <div className="current-bid-info">
        {currentBid ? (
          <span>
            {t.contract}: <strong>
              {currentBid.value === 'capot' ? t.capot : currentBid.value}
              {' '}{t.suitSymbol[currentBid.suit]}
            </strong>
            {currentBid.surcoinched && <span className="badge badge-sur"> {t.surcoinched}</span>}
            {currentBid.coinched && !currentBid.surcoinched && <span className="badge badge-coin"> {t.coinched}</span>}
          </span>
        ) : (
          <span className="muted">{t.biddingPhase}</span>
        )}
      </div>

      {/* Coinche / Surcoinche buttons — available anytime (not turn-gated) */}
      {canCoinche && (
        <button className="btn-coinche" onClick={doCoinche}>{t.coinche}</button>
      )}
      {canSurcoinche && (
        <button className="btn-surcoinche" onClick={doSurcoinche}>{t.surcoinche}</button>
      )}

      {/* Turn-gated bid/pass controls */}
      {isMyTurn && (
        <div className="bid-controls">
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

          {/* Suit selector (hidden when capot selected) */}
          {selectedValue !== 'capot' && (
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

          <div className="bid-action-row">
            <button
              className="btn-primary"
              onClick={submitBid}
              disabled={!selectedValue}
            >
              {t.bid}
            </button>
            <button className="btn-secondary" onClick={pass}>{t.pass}</button>
          </div>
        </div>
      )}

      {!isMyTurn && (
        <p className="waiting-turn">
          {/* Show who's bidding */}
        </p>
      )}
    </div>
  );
}
