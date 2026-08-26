import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { authErrorKey } from '../lib/authErrors';
import { useLang } from '../context/LanguageContext';

// Landing page for the Supabase recovery link (/reset-password). Supabase JS
// consumes the token from the URL on load (detectSessionInUrl) and emits
// PASSWORD_RECOVERY / SIGNED_IN; until one arrives we sit in 'checking'.
// An error in the URL (expired/used link) or a quiet timeout → 'invalid'.
const RECOVERY_WAIT_MS = 10_000;

// Supabase puts failures in the hash (#error=access_denied&error_code=otp_expired…)
// or, on some flows, the query string. Either means the link is dead.
function urlHasRecoveryError() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  return Boolean(hash.get('error') || query.get('error'));
}

export default function ResetPassword() {
  const { t } = useLang();
  const [status, setStatus] = useState('checking'); // 'checking' | 'ready' | 'done' | 'invalid'
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    if (urlHasRecoveryError()) {
      setStatus('invalid');
      return;
    }

    // The token may already be consumed by the time we subscribe — check the
    // session directly AND listen for the recovery events. A session arriving
    // AFTER the timeout also upgrades 'invalid' → 'ready': token validation is
    // a network round-trip that can outlive the timer on a slow connection,
    // and a genuinely dead link never reaches here (the urlHasRecoveryError
    // branch above returns before subscribing).
    const stillWaiting = () =>
      statusRef.current === 'checking' || statusRef.current === 'invalid';
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && stillWaiting()) setStatus('ready');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!stillWaiting()) return;
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
        setStatus('ready');
      }
    });

    const timer = setTimeout(() => {
      if (statusRef.current === 'checking') setStatus('invalid');
    }, RECOVERY_WAIT_MS);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError(t.passwordTooShort8); return; }
    if (password !== password2) { setError(t.passwordMismatch); return; }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setError(t[authErrorKey(error)] || error.message);
      return;
    }
    setStatus('done');
    // Land on the login form with the recovery session cleared, so the user
    // signs back in with the new password.
    setTimeout(async () => {
      await supabase.auth.signOut();
      window.location.replace('/');
    }, 2000);
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">♦ Belote ♣</h1>
        <h2>{t.resetTitle}</h2>

        {status === 'checking' && <p>…</p>}

        {status === 'invalid' && (
          <>
            <p className="error-msg">{t.resetLinkInvalid}</p>
            <button className="btn-link" onClick={() => window.location.replace('/')}>
              {t.requestNewLink}
            </button>
          </>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              {t.newPassword}
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <label>
              {t.confirmPassword}
              <input
                type="password"
                value={password2}
                onChange={e => setPassword2(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>

            {error && <p className="error-msg">{error}</p>}

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? '...' : t.resetTitle}
            </button>
          </form>
        )}

        {status === 'done' && <p className="success-msg">{t.resetSuccess}</p>}
      </div>
    </div>
  );
}
