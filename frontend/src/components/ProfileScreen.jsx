import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import Avatar from './Avatar';
import {
  OPTIONS, FEATURE_KEYS, DEFAULT_AVATAR,
  cycleFeature, randomAvatarConfig,
} from '../lib/avatar';

// Which features are color pickers (rendered as swatch rows) vs style cycles.
const COLOR_KEYS = new Set(['skinColor', 'hairColor', 'clothesColor']);

export default function ProfileScreen({ username, initialConfig, onSaved, onBack }) {
  const { user } = useAuth();
  const { t } = useLang();
  const [cfg, setCfg] = useState(initialConfig || DEFAULT_AVATAR);
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  const setFeature = (key, value) => { setCfg(c => ({ ...c, [key]: value })); setStatus('idle'); };
  const cycle = (key, dir) => { setCfg(c => cycleFeature(c, key, dir)); setStatus('idle'); };
  const randomize = () => { setCfg(randomAvatarConfig()); setStatus('idle'); };

  async function save() {
    if (!user) return;
    setStatus('saving');
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_config: cfg })
      .eq('id', user.id);
    if (error) {
      console.error('[profile] save failed:', error.message);
      setStatus('error');
      return;
    }
    setStatus('saved');
    onSaved?.(cfg); // lift to App so the lobby strip + future joins use it immediately
  }

  const initial = (username?.[0] || '?').toUpperCase();

  return (
    <div className="lobby profile-screen">
      <div className="home-wrap">
        <div className="profile-top">
          <button className="btn-link profile-back" onClick={onBack}>← {t.profile.back}</button>
          <span className="profile-title">{t.profile.title}</span>
          <span className="profile-back-spacer" aria-hidden="true" />
        </div>

        {/* Large live preview + read-only pseudo */}
        <div className="profile-preview">
          <Avatar config={cfg} initial={initial} size={132} circleClassName="profile-avatar" />
          <span className="profile-pseudo">{username}</span>
        </div>

        {/* Builder */}
        <div className="profile-builder">
          {FEATURE_KEYS.map(key => (
            <div className="builder-row" key={key}>
              <span className="builder-label">{t.profile.features[key]}</span>
              {COLOR_KEYS.has(key) ? (
                <div className="builder-swatches">
                  {OPTIONS[key].map(hex => (
                    <button
                      key={hex}
                      type="button"
                      className={`swatch${cfg[key] === hex ? ' selected' : ''}`}
                      style={{ background: `#${hex}` }}
                      aria-label={hex}
                      onClick={() => setFeature(key, hex)}
                    />
                  ))}
                </div>
              ) : (
                <div className="builder-cycle">
                  <button type="button" className="cycle-btn" onClick={() => cycle(key, -1)} aria-label="prev">‹</button>
                  <span className="cycle-pos">
                    {OPTIONS[key].indexOf(cfg[key]) + 1}/{OPTIONS[key].length}
                  </span>
                  <button type="button" className="cycle-btn" onClick={() => cycle(key, 1)} aria-label="next">›</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="profile-actions">
          <button className="btn-secondary home-action-sm" onClick={randomize}>🎲 {t.profile.randomize}</button>
          <button className="btn-primary home-action-sm" onClick={save} disabled={status === 'saving'}>
            {status === 'saving' ? t.profile.saving : status === 'saved' ? t.profile.saved : t.profile.save}
          </button>
        </div>
        {status === 'error' && <p className="error-msg profile-error">{t.profile.saveError}</p>}
      </div>
    </div>
  );
}
