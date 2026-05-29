import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import HandSizeToggle from './HandSizeToggle';

export default function Header({ roomCode, onCycleHandSize }) {
  const { username, signOut } = useAuth();
  const { lang, toggleLang, t } = useLang();

  return (
    <header className="app-header">
      <div className="app-header-row">
        <div className="app-header-row-left">
          <span className="app-logo">♦ Belote</span>
          {roomCode && <span className="room-code">{roomCode}</span>}
        </div>
      </div>

      <div className="app-header-row">
        <div className="app-header-row-left">
          {onCycleHandSize && <HandSizeToggle onCycle={onCycleHandSize} />}
        </div>
        <div className="app-header-row-right">
          <button className="btn-lang" onClick={toggleLang} title="Toggle language">
            {lang.toUpperCase()}
          </button>
          <span className="header-user">{username}</span>
          <button className="btn-link btn-signout" onClick={signOut} title={t.signOut}>⎋</button>
        </div>
      </div>
    </header>
  );
}
