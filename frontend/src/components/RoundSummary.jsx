import { useState } from 'react';
import { useLang } from '../context/LanguageContext';

const SUIT_SYM      = { S: '♠', H: '♥', D: '♦', C: '♣' };
const TRUMP_PTS     = { J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0 };
const NON_TRUMP_PTS = { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };

function cardPts(card, trump) {
  return ((card.suit === trump) ? TRUMP_PTS : NON_TRUMP_PTS)[card.value] || 0;
}

// ─── Mini auction table recap ─────────────────────────────────────────────────

function AuctionRecap({ biddingHistory, currentBid, players, myPosition, t }) {
  const perPlayer = { 0: [], 1: [], 2: [], 3: [] };
  for (const entry of (biddingHistory || [])) {
    if (perPlayer[entry.position]) perPlayer[entry.position].push(entry);
  }

  const firstBidderPos = (biddingHistory || [])[0]?.position ?? null;
  const topPos   = (myPosition + 2) % 4;
  const leftPos  = (myPosition + 3) % 4;
  const rightPos = (myPosition + 1) % 4;

  function nameAt(pos) {
    return players.find(p => p.position === pos)?.username || '?';
  }

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
    const isFirst = pos === firstBidderPos;
    return (
      <div className="ar-seat">
        <span className="ar-name">{nameAt(pos)}{isMe ? ` (${t.you})` : ''}</span>
        {isFirst && <span className="ar-first-badge">{t.firstToSpeak}</span>}
        <PlayerStack pos={pos} />
      </div>
    );
  }

  return (
    <div className="auction-recap">
      <div className="ar-top-row"><Seat pos={topPos} /></div>
      <div className="ar-mid-row">
        <Seat pos={leftPos} />
        <div className="ar-table-felt" />
        <Seat pos={rightPos} />
      </div>
      <div className="ar-bot-row"><Seat pos={myPosition} isMe /></div>
    </div>
  );
}

// ─── Step-by-step trick replay overlay ───────────────────────────────────────

function TrickReplayOverlay({ tricks, currentStep, myPosition, players, trumpSuit, t, onNext, onClose }) {
  const trick  = tricks[currentStep];
  const isLast = currentStep === tricks.length - 1;
  const leaderId = trick.cards[0]?.playerIndex;

  // Trick points (card values + dix de der on last trick)
  const rawPts  = trick.cards.reduce((s, { card }) => s + cardPts(card, trumpSuit), 0);
  const trickPts = isLast ? rawPts + 10 : rawPts;

  // Cumulative score for tricks 0..currentStep
  const cumul = [0, 0];
  for (let i = 0; i <= currentStep; i++) {
    const team = tricks[i].winner % 2;
    for (const { card } of tricks[i].cards) cumul[team] += cardPts(card, trumpSuit);
  }
  if (isLast) cumul[tricks[currentStep].winner % 2] += 10;

  const winTeam    = trick.winner % 2;
  const winnerName = players.find(p => p.position === trick.winner)?.username || '?';

  function getArea(pos) {
    return ['bottom', 'right', 'top', 'left'][((pos - myPosition) + 4) % 4];
  }

  return (
    <div className="replay-overlay" onClick={onClose}>
      <div className="replay-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="replay-header">
          <span className="replay-title">{t.trick} {currentStep + 1} / {tricks.length}</span>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {/* 4-card table layout */}
        <div className="replay-table">
          {['top', 'left', 'right', 'bottom'].map(area => {
            const entry  = trick.cards.find(({ playerIndex }) => getArea(playerIndex) === area);
            const player = entry ? players.find(p => p.position === entry.playerIndex) : null;
            const isWin  = entry?.playerIndex === trick.winner;
            const isLead = entry?.playerIndex === leaderId;
            const isRed  = entry?.card.suit === 'H' || entry?.card.suit === 'D';
            return (
              <div key={area} className={`replay-slot replay-slot-${area}`}>
                {entry ? (
                  <div className={`replay-card${isRed ? ' red' : ''}${isWin ? ' replay-win' : ''}`}>
                    {isLead && <span className="replay-lead">{t.trickLead}</span>}
                    <span className="replay-cf">{entry.card.value}{SUIT_SYM[entry.card.suit]}</span>
                    <span className="replay-cp">{player?.username}</span>
                  </div>
                ) : (
                  <div className="replay-slot-empty" />
                )}
              </div>
            );
          })}
        </div>

        {/* Trick result info */}
        <div className="replay-info">
          <div className="replay-winner-line">
            <span className={`replay-winner-badge rw-team${winTeam}`}>✓ {winnerName}</span>
            <span className="replay-trickpts">{trickPts} pts</span>
          </div>
          {isLast && <div className="replay-dixdeder">{t.dixDeDer}</div>}
          <div className="replay-cumul">
            <span className="rcu-t0">{t.team1}: <strong>{cumul[0]}</strong></span>
            <span className="rcu-sep"> — </span>
            <span className="rcu-t1">{t.team2}: <strong>{cumul[1]}</strong></span>
          </div>
        </div>

        {/* Navigation */}
        <div className="replay-nav">
          {!isLast
            ? <button className="btn-primary btn-large" onClick={onNext}>{t.replayNext} ▶</button>
            : <button className="btn-secondary btn-large" onClick={onClose}>{t.replayEnd}</button>
          }
        </div>

      </div>
    </div>
  );
}

// ─── Round summary ────────────────────────────────────────────────────────────

export default function RoundSummary({ socket, roomCode, room, game, myPosition }) {
  const { t } = useLang();
  const [replayStep, setReplayStep] = useState(-1);

  function leaveGame() {
    if (!window.confirm(t.leaveConfirmGame)) return;
    socket.emit('leaveRoom', { code: roomCode });
  }

  const {
    roundScores, contractMade, trickPoints, currentBid, beloteInfo,
    tricks, biddingHistory, trumpSuit,
  } = game;
  const { scores, players } = room;

  function getTeamLabel(teamIdx) {
    const members = players.filter(p => p.team === teamIdx).map(p => p.username);
    return members.join(' & ');
  }

  const isCapot      = currentBid?.value === 'capot';
  const contractTeam = currentBid != null ? currentBid.playerIndex % 2 : null;
  const opposingTeam = contractTeam != null ? 1 - contractTeam : null;
  const multiplier   = currentBid?.surcoinched ? 4 : currentBid?.coinched ? 2 : 1;

  const myPlayer      = players.find(p => p.position === myPosition);
  const myUserId      = myPlayer?.userId;
  const nextRoundReady = room.nextRoundReady || [];
  const myConfirmed   = myUserId ? nextRoundReady.includes(myUserId) : false;
  const readyCount    = nextRoundReady.length;
  const totalPlayers  = players.length;

  return (
    <div className="round-summary">

      {/* ── Auction recap ───────────────────────────────────────────────────── */}
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
            <p>{scores[0] > scores[1] ? getTeamLabel(0) : getTeamLabel(1)} {t.wins}</p>
          </div>
        ) : (
          myConfirmed ? (
            <button className="btn-primary btn-large" disabled>
              {t.readyCount(readyCount, totalPlayers)}
            </button>
          ) : (
            <button className="btn-primary btn-large" onClick={() => socket.emit('confirmNextRound', { code: roomCode })}>
              {t.nextRound}
            </button>
          )
        )}

        {/* Replay button — always shown when tricks exist */}
        {tricks?.length > 0 && (
          <button className="btn-secondary btn-large" onClick={() => setReplayStep(0)}>
            {t.replayBtn}
          </button>
        )}

        <button className="btn-leave" onClick={leaveGame}>{t.leaveTable}</button>
      </div>

      {/* ── Step-by-step trick replay ────────────────────────────────────────── */}
      {replayStep >= 0 && tricks?.length > 0 && (
        <TrickReplayOverlay
          tricks={tricks}
          currentStep={replayStep}
          myPosition={myPosition}
          players={players}
          trumpSuit={trumpSuit}
          t={t}
          onNext={() => setReplayStep(s => s + 1)}
          onClose={() => setReplayStep(-1)}
        />
      )}
    </div>
  );
}
