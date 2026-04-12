import { useLang } from '../context/LanguageContext';

export default function RoundSummary({ socket, roomCode, room, game }) {
  const { t } = useLang();
  const { roundScores, contractMade, trickPoints, currentBid, beloteInfo } = game;
  const { scores, players } = room;

  function getTeamLabel(teamIdx) {
    const members = players.filter(p => p.team === teamIdx).map(p => p.username);
    return members.join(' & ');
  }

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
            {currentBid.surcoinched && <span className="badge badge-sur"> ×4</span>}
            {currentBid.coinched && !currentBid.surcoinched && <span className="badge badge-coin"> ×2</span>}
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
                <td className="score-label">{t.roundScore} (tricks)</td>
                <td>{trickPoints[0]}</td>
                <td>{trickPoints[1]}</td>
              </tr>
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
            <p>
              {scores[0] > scores[1] ? getTeamLabel(0) : getTeamLabel(1)} {t.wins}
            </p>
          </div>
        ) : (
          <button className="btn-primary btn-large" onClick={() => socket.emit('nextRound', { code: roomCode })}>
            {t.nextRound}
          </button>
        )}
        <button
          className="btn-leave"
          onClick={() => socket.emit('leaveRoom', { code: roomCode })}
        >
          {t.leaveTable}
        </button>
      </div>
    </div>
  );
}
