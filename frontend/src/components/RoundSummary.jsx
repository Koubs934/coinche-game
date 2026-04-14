import { useState } from 'react';
import { useLang } from '../context/LanguageContext';

const SUIT_SYM      = { S: '♠', H: '♥', D: '♦', C: '♣' };
const TRUMP_PTS     = { J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0 };
const NON_TRUMP_PTS = { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };

function cardPts(card, trump) {
  return ((card.suit === trump) ? TRUMP_PTS : NON_TRUMP_PTS)[card.value] || 0;
}

// ─── Unified top area: auction recap ↔ trick replay ──────────────────────────
//
// replayStep -1  → auction recap mode
// replayStep 0+  → trick replay mode, showing tricks[replayStep]

function TopArea({
  biddingHistory, currentBid,
  tricks, trumpSuit,
  players, myPosition,
  replayStep, onStartReplay, onNextTrick, onPrevTrick, onEndReplay,
  t,
}) {
  const isReplaying = replayStep >= 0;
  const hasTricks   = tricks?.length > 0;

  const topPos   = (myPosition + 2) % 4;
  const leftPos  = (myPosition + 3) % 4;
  const rightPos = (myPosition + 1) % 4;

  function nameAt(pos) {
    return players.find(p => p.position === pos)?.username || '?';
  }

  // ── Auction data ────────────────────────────────────────────────────────────
  const perPlayer = { 0: [], 1: [], 2: [], 3: [] };
  for (const entry of (biddingHistory || [])) {
    if (perPlayer[entry.position]) perPlayer[entry.position].push(entry);
  }
  const firstBidderPos = (biddingHistory || [])[0]?.position ?? null;

  // ── Replay data ─────────────────────────────────────────────────────────────
  const trick      = isReplaying ? tricks[replayStep] : null;
  const isLastTrick = isReplaying && replayStep === tricks.length - 1;
  const leaderId   = trick?.cards[0]?.playerIndex ?? null;
  const winTeam    = trick ? trick.winner % 2 : null;
  const winnerName = trick ? (players.find(p => p.position === trick.winner)?.username || '?') : null;

  let trickPts = 0;
  const cumul  = [0, 0];
  if (isReplaying) {
    trickPts = trick.cards.reduce((s, { card }) => s + cardPts(card, trumpSuit), 0);
    if (isLastTrick) trickPts += 10;
    for (let i = 0; i <= replayStep; i++) {
      const team = tricks[i].winner % 2;
      for (const { card } of tricks[i].cards) cumul[team] += cardPts(card, trumpSuit);
    }
    if (isLastTrick) cumul[trick.winner % 2] += 10;
  }

  // ── Per-seat content (switches with mode) ───────────────────────────────────
  function SeatContent({ pos }) {
    if (isReplaying) {
      const entry = trick.cards.find(({ playerIndex }) => playerIndex === pos);
      if (!entry) return <div className="ta-card-empty" />;
      const isWin  = entry.playerIndex === trick.winner;
      const isLead = entry.playerIndex === leaderId;
      const isRed  = entry.card.suit === 'H' || entry.card.suit === 'D';
      return (
        <div className={`ta-card${isRed ? ' red' : ''}${isWin ? ' ta-win' : ''}`}>
          {isLead && <span className="ta-lead">{t.trickLead}</span>}
          <span className="ta-cf">{entry.card.value}{SUIT_SYM[entry.card.suit]}</span>
        </div>
      );
    }

    // Auction mode
    const isFirst = pos === firstBidderPos;
    const actions = [...perPlayer[pos]].reverse();
    return (
      <>
        {isFirst && <span className="ar-first-badge">{t.trickLead}</span>}
        {actions.length > 0 && (
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
        )}
      </>
    );
  }

  function Seat({ pos, isMe }) {
    return (
      <div className="ar-seat">
        <span className="ar-name">{nameAt(pos)}{isMe ? ` (${t.you})` : ''}</span>
        <SeatContent pos={pos} />
      </div>
    );
  }

  return (
    <div className="auction-recap">

      {/* Mode label */}
      <div className="ta-header">
        <span className="ta-mode-label">
          {isReplaying
            ? `${t.trick} ${replayStep + 1} / ${tricks.length}`
            : t.biddingPhase}
        </span>
      </div>

      {/* Seats */}
      <div className="ar-top-row"><Seat pos={topPos} /></div>
      <div className="ar-mid-row">
        <Seat pos={leftPos} />

        {/* Center: felt in auction mode, trick info in replay mode */}
        {isReplaying ? (
          <div className="ta-trick-info">
            <span className={`ta-winner-badge twb-team${winTeam}`}>✓ {winnerName}</span>
            <span className="ta-pts">{trickPts} pts</span>
            {isLastTrick && <span className="ta-ddd">{t.dixDeDer}</span>}
            <div className="ta-cumul">
              <span className="rcu-t0"><strong>{cumul[0]}</strong></span>
              <span className="rcu-sep"> – </span>
              <span className="rcu-t1"><strong>{cumul[1]}</strong></span>
            </div>
          </div>
        ) : (
          <div className="ar-table-felt" />
        )}

        <Seat pos={rightPos} />
      </div>
      <div className="ar-bot-row"><Seat pos={myPosition} isMe /></div>

      {/* Bottom nav: Rejouer in summary mode, Précédent+Suivant in replay mode */}
      {hasTricks && (
        <div className={`ta-nav${isReplaying ? ' ta-nav-replay' : ''}`}>
          {isReplaying ? (
            <>
              <button className="ta-btn ta-btn-sec" onClick={replayStep === 0 ? onEndReplay : onPrevTrick}>
                ◀ {replayStep === 0 ? t.replayEnd : t.replayPrev}
              </button>
              <button
                className={isLastTrick ? 'ta-btn ta-btn-sec' : 'ta-btn ta-btn-pri'}
                onClick={isLastTrick ? onEndReplay : onNextTrick}
              >
                {isLastTrick ? t.replayEnd : `${t.replayNext} ▶`}
              </button>
            </>
          ) : (
            <button className="ta-btn ta-btn-pri ta-btn-replay" onClick={onStartReplay}>
              {t.replayBtn}
            </button>
          )}
        </div>
      )}

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

  const showTopArea = (biddingHistory?.length > 0) || (tricks?.length > 0);

  return (
    <div className="round-summary">

      {/* ── Top area: auction recap ↔ trick replay ──────────────────────────── */}
      {showTopArea && (
        <TopArea
          biddingHistory={biddingHistory}
          currentBid={currentBid}
          tricks={tricks}
          trumpSuit={trumpSuit}
          players={players}
          myPosition={myPosition}
          replayStep={replayStep}
          onStartReplay={() => setReplayStep(0)}
          onPrevTrick={() => setReplayStep(s => s - 1)}
          onNextTrick={() => setReplayStep(s => s + 1)}
          onEndReplay={() => setReplayStep(-1)}
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

        <button className="btn-leave" onClick={leaveGame}>{t.leaveTable}</button>
      </div>
    </div>
  );
}
