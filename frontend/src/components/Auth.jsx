import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import { authErrorKey } from '../lib/authErrors';

const API_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Username → email resolution against the backend. Returns:
//   { email }          on a unique match
//   { errorKey }       i18n key for every failure the user can act on
async function resolveEmail(username) {
  let res;
  try {
    res = await fetch(`${API_URL}/api/auth/resolve-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
  } catch {
    return { errorKey: 'authNetworkError' };
  }
  if (res.status === 404) return { errorKey: 'unknownPlayer' };
  if (res.status === 409) return { errorKey: 'ambiguousPlayer' };
  if (!res.ok) return { errorKey: 'authNetworkError' };
  const data = await res.json().catch(() => null);
  if (!data?.email) return { errorKey: 'authNetworkError' };
  return { email: data.email };
}

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const { t } = useLang();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [identifier, setIdentifier] = useState(''); // signin: player name OR email
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  function switchMode(next) {
    setMode(next);
    setError('');
    setSuccess('');
  }

  async function handleSignIn() {
    const id = identifier.trim();
    // Email fallback: an "@" means the user typed their address directly.
    let signInEmail = id;
    if (!id.includes('@')) {
      const resolved = await resolveEmail(id);
      if (resolved.errorKey) {
        setError(t[resolved.errorKey]);
        return;
      }
      signInEmail = resolved.email;
    }
    const { error } = await signIn(signInEmail, password);
    if (error) setError(t[authErrorKey(error)] || error.message);
  }

  async function handleSignUp() {
    const cleanUsername = username.trim();
    if (cleanUsername.length < 2) {
      setError(t.usernameTooShort);
      return;
    }
    if (cleanUsername.includes('@')) {
      setError(t.usernameNoAt);
      return;
    }
    // Uniqueness gate — a resolvable (or ambiguous) name is already taken.
    // A lookup outage blocks signup rather than risking a duplicate.
    const resolved = await resolveEmail(cleanUsername);
    if (resolved.email || resolved.errorKey === 'ambiguousPlayer') {
      setError(t.usernameTaken);
      return;
    }
    if (resolved.errorKey !== 'unknownPlayer') {
      setError(t.authNetworkError);
      return;
    }
    const { error } = await signUp(email, password, cleanUsername);
    if (error) setError(t[authErrorKey(error)] || error.message);
    else setSuccess(t.accountCreated);
  }

  async function handleForgot() {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    // Same neutral message whether the account exists or not (no enumeration);
    // real failures (SMTP quota, rate limit) only reach the console.
    if (error) console.error('resetPasswordForEmail:', error.message);
    setSuccess(t.resetEmailSent);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    if (mode === 'signin')      await handleSignIn();
    else if (mode === 'signup') await handleSignUp();
    else                        await handleForgot();
    setLoading(false);
  }

  const title = mode === 'signin' ? t.signIn : mode === 'signup' ? t.signUp : t.forgotTitle;
  const submitLabel = mode === 'signin' ? t.signIn : mode === 'signup' ? t.signUp : t.sendResetLink;

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">♦ Belote ♣</h1>
        <h2>{title}</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signin' && (
            <label>
              {t.playerName}
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
                autoComplete="username"
              />
            </label>
          )}

          {(mode === 'signup' || mode === 'forgot') && (
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
          )}

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

          {mode !== 'forgot' && (
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
          )}

          {error && <p className="error-msg">{error}</p>}
          {success && <p className="success-msg">{success}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '...' : submitLabel}
          </button>
        </form>

        {/* disabled while a submit is in flight so a late completion can't
            paint its error/success onto a different mode's form */}
        {mode === 'signin' && (
          <button className="btn-link" disabled={loading} onClick={() => switchMode('forgot')}>
            {t.forgotPassword}
          </button>
        )}

        <button
          className="btn-link"
          disabled={loading}
          onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? t.noAccount : mode === 'signup' ? t.haveAccount : t.backToLogin}
        </button>
      </div>
    </div>
  );
}
