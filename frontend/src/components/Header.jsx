import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

export default function Header({ roomCode, scores, targetScore }) {
  const { username, signOut } = useAuth();
  const { lang, toggleLang, t } = useLang();

  return (
    <header className="app-header">
      <div className="header-left">
        <span className="app-logo">♦ Coinche</span>
        {roomCode && <span className="room-code">{roomCode}</span>}
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
          {lang === 'en' ? 'FR' : 'EN'}
        </button>
        <span className="header-user">{username}</span>
        <button className="btn-link btn-signout" onClick={signOut} title={t.signOut}>⎋</button>
      </div>
    </header>
  );
}
