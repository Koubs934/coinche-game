import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import HandSizeToggle from './HandSizeToggle';

export default function Header({ roomCode, scores, targetScore, onCycleHandSize }) {
  const { username, signOut } = useAuth();
  const { lang, toggleLang, t } = useLang();

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-left-row">
          <span className="app-logo">♦ Belote</span>
          {roomCode && <span className="room-code">{roomCode}</span>}
        </div>
        {onCycleHandSize && <HandSizeToggle onCycle={onCycleHandSize} />}
      </div>

      {scores && (
        <div className="header-scores">
          <span className="score-item team0">
            {t.team1}: <strong>{scores[0]}</strong>
          </span>
          <span className="score-sep">/</span>
          <span className="score-item team1">
            {t.team2}: <strong>{scores[1]}</strong>
          </span>
          {targetScore && <span className="score-target">— {targetScore}</span>}
        </div>
      )}

      <div className="header-right">
        <button className="btn-lang" onClick={toggleLang} title="Toggle language">
          {lang.toUpperCase()}
        </button>
        <span className="header-user">{username}</span>
        <button className="btn-link btn-signout" onClick={signOut} title={t.signOut}>⎋</button>
      </div>
    </header>
  );
}
