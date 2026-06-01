import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import Avatar from './Avatar';
import { OPTIONS, DEFAULT_AVATAR, randomAvatarConfig } from '../lib/avatar';

// Builder categories, in display order. `part` is the OPTIONS key it edits;
// `variant` is how its thumbnails preview (full figure for the body/pose, a head
// crop for the face parts). 'colors' is special — it edits two colour keys via
// swatch rows rather than figure thumbnails.
const CATEGORIES = [
  { id: 'body',       part: 'body',       variant: 'full' },
  { id: 'face',       part: 'face',       variant: 'head' },
  { id: 'hair',       part: 'hair',       variant: 'head' },
  { id: 'facialHair', part: 'facialHair', variant: 'head' },
  { id: 'accessory',  part: 'accessory',  variant: 'head' },
  { id: 'colors' },
];
const COLOR_KEYS = ['strokeColor', 'backgroundColor'];

export default function ProfileScreen({ username, initialConfig, onSaved, onBack }) {
  const { user } = useAuth();
  const { t } = useLang();
  const [cfg, setCfg] = useState(initialConfig || DEFAULT_AVATAR);
  const [openCat, setOpenCat] = useState('body');
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  const setFeature = (key, value) => { setCfg(c => ({ ...c, [key]: value })); setStatus('idle'); };
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
  const cat = CATEGORIES.find(c => c.id === openCat);

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
          <Avatar config={cfg} initial={initial} variant="full" circleClassName="profile-avatar" />
          <span className="profile-pseudo">{username}</span>
        </div>

        {/* Builder: category tabs + a browsable strip of the open category's
            options. Only the open category's thumbnails are mounted (keeps it
            light despite there being dozens of options per part). */}
        <div className="profile-builder">
          <div className="builder-tabs" role="tablist">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={openCat === c.id}
                className={`builder-tab${openCat === c.id ? ' active' : ''}`}
                onClick={() => setOpenCat(c.id)}
              >
                {t.profile.features[c.id]}
              </button>
            ))}
          </div>

          {openCat === 'colors' ? (
            <div className="builder-colors">
              {COLOR_KEYS.map(key => (
                <div className="builder-color-row" key={key}>
                  <span className="builder-color-label">{t.profile.features[key]}</span>
                  <div className="builder-swatches">
                    {OPTIONS[key].map(hex => (
                      <button
                        key={hex}
                        type="button"
                        className={`swatch${cfg[key] === hex ? ' selected' : ''}`}
                        style={{ background: hex }}
                        aria-label={hex}
                        onClick={() => setFeature(key, hex)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="builder-strip">
              {OPTIONS[cat.part].map(opt => (
                <button
                  key={opt}
                  type="button"
                  className={`builder-thumb${cfg[cat.part] === opt ? ' selected' : ''}`}
                  aria-pressed={cfg[cat.part] === opt}
                  title={opt}
                  onClick={() => setFeature(cat.part, opt)}
                >
                  <Avatar
                    config={{ ...cfg, [cat.part]: opt }}
                    variant={cat.variant}
                    circleClassName={`builder-thumb-fig builder-thumb-${cat.variant}`}
                  />
                </button>
              ))}
            </div>
          )}
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
