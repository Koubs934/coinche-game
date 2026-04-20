import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const { t } = useLang();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    } else {
      const cleanUsername = username.trim();
      if (cleanUsername.length < 2) {
        setError(t.usernameTooShort);
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, cleanUsername);
      if (error) setError(error.message);
      else setSuccess('Account created! Check your email to confirm, then sign in.');
    }
    setLoading(false);
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">♦ Belote ♣</h1>
        <h2>{mode === 'signin' ? t.signIn : t.signUp}</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            {t.email}
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          {mode === 'signup' && (
            <label>
              {t.username}
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                maxLength={20}
                autoComplete="username"
              />
            </label>
          )}

          <label>
            {t.password}
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </label>

          {error && <p className="error-msg">{error}</p>}
          {success && <p className="success-msg">{success}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '...' : (mode === 'signin' ? t.signIn : t.signUp)}
          </button>
        </form>

        <button
          className="btn-link"
          onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess(''); }}
        >
          {mode === 'signin' ? t.noAccount : t.haveAccount}
        </button>
      </div>
    </div>
  );
}
