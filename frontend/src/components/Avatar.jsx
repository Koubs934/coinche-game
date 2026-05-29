import { useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';
import { toDiceBearOptions, normalizeAvatarConfig } from '../lib/avatar';

// One avatar used everywhere. Precedence:
//   bot            → keep the 🤖 placeholder (in the styled circle)
//   config present → render the DiceBear (avataaars) SVG, deterministic, no network
//   else           → the letter-circle fallback (initial)
//
// `circleClassName` carries the existing circle styling at each call site
// (e.g. "home-avatar", "friend-avatar", "player-avatar team0-avatar") so the
// fallback keeps its look AND a colored backdrop shows behind the SVG — which,
// for in-game seats, preserves the per-team color cue. `size` (px) overrides the
// class size when given (used by the large Profile preview); otherwise the
// circle class sets the dimensions.
export default function Avatar({
  config,
  isBot = false,
  initial = '?',
  size,
  circleClassName = '',
  circleStyle,
  onClick,
  title,
}) {
  const svg = useMemo(() => {
    if (isBot) return null;
    const norm = normalizeAvatarConfig(config);
    if (!norm) return null;
    try {
      return createAvatar(avataaars, toDiceBearOptions(norm)).toString();
    } catch {
      return null; // any render error → fall back to the letter circle
    }
  }, [isBot, config && JSON.stringify(config)]);

  const style = { ...(size ? { width: size, height: size } : null), ...circleStyle };
  const clickable = typeof onClick === 'function';
  const base = `avatar ${circleClassName}${clickable ? ' avatar-clickable' : ''}`.trim();
  const interactive = clickable
    ? { onClick, role: 'button', tabIndex: 0, title }
    : { 'aria-hidden': 'true' };

  if (svg) {
    return (
      <div
        className={`${base} avatar-img`}
        style={style}
        {...interactive}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  return (
    <div className={base} style={style} {...interactive}>
      {isBot ? '🤖' : initial}
    </div>
  );
}
