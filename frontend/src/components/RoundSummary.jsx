import { useState } from 'react';
import { useLang } from '../context/LanguageContext';

const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };

export default function RoundSummary({ socket, roomCode, room, game, myPosition }) {
  const { t } = useLang();
  const [showTrickReview, setShowTrickReview] = useState(false);

  function leaveGame() {
    if (!window.confirm(t.leaveConfirmGame)) return;
    socket.emit('leaveRoom', { code: roomCode });
  }

  const { roundScores, contractMade, trickPoints, currentBid, beloteInfo, tricks } = game;
  const { scores, players } = room;

  function getTeamLabel(teamIdx) {
    const members = players.filter(p => p.team === teamIdx).map(p => p.username);
    return members.join(' & ');
  }

  // Per-player confirmation state
  const myPlayer = players.find(p => p.position === myPosition);
  const myUserId = myPlayer?.userId;
  const nextRoundReady = room.nextRoundReady || [];
  const myConfirmed = myUserId ? nextRoundReady.includes(myUserId) : false;
  const readyCount = nextRoundReady.length;
  const totalPlayers = players.length;

  return (
    <div className="round-summary">
      <div className="summary-card">
        <h2>{t.roundOver}</h2>

        <div className={`contract-result ${contractMade ? 'made' : 'failed'}`}>
          {contractMade ? t.contractMade : t.contractFailed}
        </div>

        {currentBid && (
          <div className="summary-contract">
            {t.contract}: {currentBid.value === 'capot' ? t.capot : currentBid.value}
            {' '}{t.suitSymbol[currentBid.suit]}
            {currentBid.surcoinched && <span className="badge badge-sur"> — {t.surcoinched}</span>}
            {currentBid.coinched && !currentBid.surcoinched && <span className="badge badge-coin"> — {t.coinched}</span>}
          </div>
        )}

        {beloteInfo?.complete && (
          <div className="belote-note">
            {t.belote}/{t.rebelote}: +20 pts ({t.team} {(beloteInfo.team === 0 ? '1' : '2')})
          </div>
        )}

        <table className="score-table">
          <thead>
            <tr>
              <th></th>
              <th>{t.team1}</th>
              <th>{t.team2}</th>
            </tr>
          </thead>
          <tbody>
            {trickPoints && (
              <tr>
                <td className="score-label">{t.trickPoints}</td>
                <td>{trickPoints[0]}</td>
                <td>{trickPoints[1]}</td>
              </tr>
            )}
            {currentBid && (() => {
              const contractTeam = currentBid.playerIndex % 2;
              const val = currentBid.value === 'capot' ? t.capot : currentBid.value;
              return (
                <tr>
                  <td className="score-label">{t.announcedPoints}</td>
                  <td>{contractTeam === 0 ? val : 0}</td>
                  <td>{contractTeam === 1 ? val : 0}</td>
                </tr>
              );
            })()}
            {/* Coinche / Surcoinche bonus row — only for successful numeric contracts */}
            {contractMade && currentBid && typeof currentBid.value === 'number' &&
              (currentBid.coinched || currentBid.surcoinched) && (() => {
              const contractTeam = currentBid.playerIndex % 2;
              const multiplier = currentBid.surcoinched ? 4 : 2;
              const bonus = currentBid.value * (multiplier - 1);
              const label = currentBid.surcoinched ? t.surcoinchBonus : t.coincheBonus;
              return (
                <tr>
                  <td className="score-label">{label} ({currentBid.value})</td>
                  <td>{contractTeam === 0 ? bonus : 0}</td>
                  <td>{contractTeam === 1 ? bonus : 0}</td>
                </tr>
              );
            })()}
            <tr className="round-final">
              <td className="score-label">{t.roundScore}</td>
              <td className={roundScores[0] > roundScores[1] ? 'winner-score' : ''}>{roundScores[0]}</td>
              <td className={roundScores[1] > roundScores[0] ? 'winner-score' : ''}>{roundScores[1]}</td>
            </tr>
            <tr className="total-row">
              <td className="score-label">{t.totalScore}</td>
              <td className={scores[0] >= scores[1] ? 'leader-score' : ''}>{scores[0]}</td>
              <td className={scores[1] > scores[0] ? 'leader-score' : ''}>{scores[1]}</td>
            </tr>
          </tbody>
        </table>

        <div className="team-names-row">
          <span>{getTeamLabel(0)}</span>
          <span>{getTeamLabel(1)}</span>
        </div>

        {room.phase === 'GAME_OVER' ? (
          <div className="game-over-section">
            <h3>{t.gameOver}</h3>
            <p>
              {scores[0] > scores[1] ? getTeamLabel(0) : getTeamLabel(1)} {t.wins}
            </p>
          </div>
        ) : (
          <>
            {myConfirmed ? (
              <button className="btn-primary btn-large" disabled>
                {t.readyCount(readyCount, totalPlayers)}
              </button>
            ) : (
              <button className="btn-primary btn-large" onClick={() => socket.emit('confirmNextRound', { code: roomCode })}>
                {t.nextRound}
              </button>
            )}
            {tricks?.length > 0 && (
              <button className="btn-secondary btn-large" onClick={() => setShowTrickReview(true)}>
                {t.seeAllTricks}
              </button>
            )}
          </>
        )}

        <button className="btn-leave" onClick={leaveGame}>
          {t.leaveTable}
        </button>
      </div>

      {/* ── Trick review modal ────────────────────────────────────────────── */}
      {showTrickReview && tricks?.length > 0 && (
        <div className="trick-review-overlay" onClick={() => setShowTrickReview(false)}>
          <div className="trick-review-panel" onClick={e => e.stopPropagation()}>
            <div className="trick-review-header">
              <span className="trick-review-title">{t.allTricks}</span>
              <button className="btn-close" onClick={() => setShowTrickReview(false)}>✕</button>
            </div>
            <div className="trick-review-list">
              {tricks.map((trick, i) => {
                const winner = players.find(p => p.position === trick.winner);
                return (
                  <div key={i} className="tri-item">
                    <div className="tri-header">
                      {t.trick} {i + 1} — <span className="tri-winner-name">{winner?.username}</span>
                    </div>
                    <div className="tri-cards">
                      {trick.cards.map(({ card, playerIndex }) => {
                        const player = players.find(p => p.position === playerIndex);
                        const isRed = card.suit === 'H' || card.suit === 'D';
                        const isWinner = playerIndex === trick.winner;
                        return (
                          <div key={playerIndex} className={`tri-card${isRed ? ' red' : ''}${isWinner ? ' tri-card-won' : ''}`}>
                            <span className="tri-card-face">{card.value}{SUIT_SYM[card.suit]}</span>
                            <span className="tri-card-player">{player?.username}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
