import { useState } from 'react';
import { useLang } from '../context/LanguageContext';

const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };

// ─── Mini auction table recap ─────────────────────────────────────────────────

function AuctionRecap({ biddingHistory, currentBid, players, myPosition, t }) {
  // Group all actions by player position, keeping chronological order
  const perPlayer = { 0: [], 1: [], 2: [], 3: [] };
  for (const entry of (biddingHistory || [])) {
    if (perPlayer[entry.position]) perPlayer[entry.position].push(entry);
  }

  const topPos   = (myPosition + 2) % 4;
  const leftPos  = (myPosition + 3) % 4;
  const rightPos = (myPosition + 1) % 4;

  function nameAt(pos) {
    return players.find(p => p.position === pos)?.username || '?';
  }

  // Vertical stack of actions for one player, latest at top
  function PlayerStack({ pos }) {
    const actions = [...perPlayer[pos]].reverse();
    if (!actions.length) return null;
    return (
      <div className="ar-stack">
        {actions.map((entry, i) => {
          const isWinningBid =
            entry.type === 'bid' &&
            pos === currentBid?.playerIndex &&
            entry.value === currentBid?.value &&
            entry.suit  === currentBid?.suit;
          const isRed = entry.suit === 'H' || entry.suit === 'D';

          let label;
          if      (entry.type === 'pass')        label = t.pass;
          else if (entry.type === 'coinche')     label = t.coinched;
          else if (entry.type === 'surcoinche')  label = t.surcoinched;
          else label = entry.value === 'capot' ? t.capot : `${entry.value} ${SUIT_SYM[entry.suit]}`;

          let cls = 'ar-action';
          if      (entry.type === 'surcoinche')  cls += ' ar-surcoinche';
          else if (entry.type === 'coinche')     cls += ' ar-coinche';
          else if (isWinningBid)                 cls += ` ar-win${isRed ? ' red' : ''}`;
          else if (entry.type === 'pass')        cls += ' ar-pass';
          else if (i === 0)                      cls += ` ar-latest${isRed ? ' red' : ''}`;
          else                                   cls += ' ar-old';

          return <span key={i} className={cls}>{label}</span>;
        })}
      </div>
    );
  }

  function Seat({ pos, isMe }) {
    return (
      <div className="ar-seat">
        <span className="ar-name">{nameAt(pos)}{isMe ? ` (${t.you})` : ''}</span>
        <PlayerStack pos={pos} />
      </div>
    );
  }

  return (
    <div className="auction-recap">
      <div className="ar-top-row">
        <Seat pos={topPos} />
      </div>
      <div className="ar-mid-row">
        <Seat pos={leftPos} />
        <div className="ar-table-felt" />
        <Seat pos={rightPos} />
      </div>
      <div className="ar-bot-row">
        <Seat pos={myPosition} isMe />
      </div>
    </div>
  );
}

// ─── Round summary ────────────────────────────────────────────────────────────

export default function RoundSummary({ socket, roomCode, room, game, myPosition }) {
  const { t } = useLang();
  const [showTrickReview, setShowTrickReview] = useState(false);

  function leaveGame() {
    if (!window.confirm(t.leaveConfirmGame)) return;
    socket.emit('leaveRoom', { code: roomCode });
  }

  const { roundScores, contractMade, trickPoints, currentBid, beloteInfo, tricks, biddingHistory } = game;
  const { scores, players } = room;

  function getTeamLabel(teamIdx) {
    const members = players.filter(p => p.team === teamIdx).map(p => p.username);
    return members.join(' & ');
  }

  // Derived scoring values
  const isCapot = currentBid?.value === 'capot';
  const contractTeam = currentBid != null ? currentBid.playerIndex % 2 : null;
  const opposingTeam = contractTeam != null ? 1 - contractTeam : null;
  const multiplier = currentBid?.surcoinched ? 4 : currentBid?.coinched ? 2 : 1;

  // Per-player confirmation state
  const myPlayer = players.find(p => p.position === myPosition);
  const myUserId = myPlayer?.userId;
  const nextRoundReady = room.nextRoundReady || [];
  const myConfirmed = myUserId ? nextRoundReady.includes(myUserId) : false;
  const readyCount = nextRoundReady.length;
  const totalPlayers = players.length;

  return (
    <div className="round-summary">

      {/* ── Auction recap — fills the green area above the score card ───────── */}
      {biddingHistory?.length > 0 && (
        <AuctionRecap
          biddingHistory={biddingHistory}
          currentBid={currentBid}
          players={players}
          myPosition={myPosition}
          t={t}
        />
      )}

      {/* ── Score card ──────────────────────────────────────────────────────── */}
      <div className="summary-card">
        <h2>{t.roundOver}</h2>

        <div className={`contract-result ${contractMade ? 'made' : 'failed'}`}>
          {contractMade ? t.contractMade : t.contractFailed}
        </div>

        {currentBid && (
          <div className="summary-contract">
            {t.contract}: {isCapot ? t.capot : currentBid.value}
            {' '}{t.suitSymbol[currentBid.suit]}
            {currentBid.surcoinched && <span className="badge badge-sur"> — {t.surcoinched}</span>}
            {currentBid.coinched && !currentBid.surcoinched && <span className="badge badge-coin"> — {t.coinched}</span>}
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

            {/* ── CAPOT (flat score, no trick breakdown) ──────────────────── */}
            {isCapot && currentBid && (() => {
              const winTeam = contractMade ? contractTeam : opposingTeam;
              const capotBase = 500;
              const bonus = capotBase * (multiplier - 1);
              return (
                <>
                  <tr>
                    <td className="score-label">{t.capot} (500)</td>
                    <td>{winTeam === 0 ? capotBase : 0}</td>
                    <td>{winTeam === 1 ? capotBase : 0}</td>
                  </tr>
                  {multiplier > 1 && (
                    <tr>
                      <td className="score-label">
                        {multiplier === 4 ? t.surcoinchBonus : t.coincheBonus} (+{bonus})
                      </td>
                      <td>{winTeam === 0 ? bonus : 0}</td>
                      <td>{winTeam === 1 ? bonus : 0}</td>
                    </tr>
                  )}
                </>
              );
            })()}

            {/* ── SUCCESSFUL normal/coinché/surcoinché contract ────────────── */}
            {!isCapot && contractMade && currentBid && (
              <>
                {trickPoints && (
                  <tr>
                    <td className="score-label">{t.trickPoints}</td>
                    <td>{trickPoints[0]}</td>
                    <td>{trickPoints[1]}</td>
                  </tr>
                )}
                {beloteInfo?.complete && (
                  <tr>
                    <td className="score-label">{t.belote}/{t.rebelote} (+20)</td>
                    <td>{beloteInfo.team === 0 ? 20 : 0}</td>
                    <td>{beloteInfo.team === 1 ? 20 : 0}</td>
                  </tr>
                )}
                <tr>
                  <td className="score-label">{t.announcedPoints}</td>
                  <td>{contractTeam === 0 ? currentBid.value : 0}</td>
                  <td>{contractTeam === 1 ? currentBid.value : 0}</td>
                </tr>
                {multiplier > 1 && (
                  <tr>
                    <td className="score-label">
                      {multiplier === 4 ? t.surcoinchBonus : t.coincheBonus} (+{currentBid.value * (multiplier - 1)})
                    </td>
                    <td>{contractTeam === 0 ? currentBid.value * (multiplier - 1) : 0}</td>
                    <td>{contractTeam === 1 ? currentBid.value * (multiplier - 1) : 0}</td>
                  </tr>
                )}
              </>
            )}

            {/* ── FAILED normal/coinché/surcoinché contract ────────────────── */}
            {!isCapot && !contractMade && currentBid && (
              <>
                {trickPoints && (
                  <tr className="row-informational">
                    <td className="score-label">{t.trickPoints}</td>
                    <td>{trickPoints[0]}</td>
                    <td>{trickPoints[1]}</td>
                  </tr>
                )}
                <tr>
                  <td className="score-label">{t.chutePenalty} (160)</td>
                  <td>{opposingTeam === 0 ? 160 : 0}</td>
                  <td>{opposingTeam === 1 ? 160 : 0}</td>
                </tr>
                <tr>
                  <td className="score-label">
                    {multiplier === 4
                      ? `${t.surcoinchBonus} (${currentBid.value})`
                      : multiplier === 2
                      ? `${t.coincheBonus} (${currentBid.value})`
                      : `${t.announcedPoints} (${currentBid.value})`}
                  </td>
                  <td>{opposingTeam === 0 ? currentBid.value * multiplier : 0}</td>
                  <td>{opposingTeam === 1 ? currentBid.value * multiplier : 0}</td>
                </tr>
              </>
            )}

            {/* ── Round score & cumulative total (always shown) ────────────── */}
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
