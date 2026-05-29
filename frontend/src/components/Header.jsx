import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

export default function Header({ roomCode, onOpenSettings }) {
  const { username } = useAuth();
  const { t } = useLang();

  return (
    <header className="app-header">
      <div className="app-header-row">
        <div className="app-header-row-left">
          <span className="app-logo">♦ Belote</span>
          {roomCode && <span className="room-code">{roomCode}</span>}
        </div>
        <div className="app-header-row-right">
          <span className="header-user">{username}</span>
          <button className="btn-settings" onClick={onOpenSettings} title={t.settings}>⚙</button>
        </div>
      </div>
    </header>
  );
}
