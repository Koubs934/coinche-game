import { useMemo } from 'react';
import Peep from 'react-peeps';
import { toPeepProps, normalizeAvatarConfig, botAvatarConfig } from '../lib/avatar';

// One avatar used everywhere, rendering an Open Peeps figure (react-peeps).
// Precedence:
//   bot            → a DISTINCT figure seeded from the bot (botSeed) + a bot ring
//   config present → the player's saved figure, deterministic, no network
//   else           → the letter-circle fallback (initial) — covers no config AND
//                    old avataaars blobs (normalizeAvatarConfig rejects those)
//
// Two variants share the SAME config:
//   • variant="full" — the whole standing figure (Profile preview, waiting room)
//   • variant="head" — head-only crop (in-game seats, lobby strip, friends, throw
//                      targets). We omit the body and zoom the viewBox to the head,
//                      which sits at a fixed position regardless of pose.
//
// `circleClassName` carries the per-call-site styling (e.g. "player-avatar
// team0-avatar", "friend-avatar") so the fallback keeps its look and a colored
// backdrop can show behind the figure. `size` (px) overrides the class size.

// The head sits at a fixed spot in react-peeps' 850×1200 figure (the head <g> is
// translate(225 0) independent of body pose), so one crop works for every figure.
// FULL frames the whole standing figure head-to-feet (react-peeps' standing
// poses are ~3000 user-units tall, far taller than its default 1200 frame).
// HEAD zooms to the face; the head <g> is fixed regardless of pose, so the same
// crop frames every figure (long hair / buns crop at the edge, as expected).
const FULL_VIEWBOX = { x: -230, y: -50, width: 1320, height: 3080 };
const HEAD_VIEWBOX = { x: 240,  y: 18,  width: 470,  height: 470 };

export default function Avatar({
  config,
  isBot = false,
  botSeed,
  initial = '?',
  size,
  variant = 'head',
  circleClassName = '',
  circleStyle,
  onClick,
  title,
}) {
  const cfg = useMemo(
    () => (isBot ? botAvatarConfig(botSeed ?? initial) : normalizeAvatarConfig(config)),
    [isBot, botSeed, initial, config && JSON.stringify(config)],
  );

  const style = { ...(size ? { width: size, height: size } : null), ...circleStyle };
  const clickable = typeof onClick === 'function';
  const isFull = variant === 'full';
  const base = [
    'avatar',
    circleClassName,
    clickable ? 'avatar-clickable' : '',
  ].filter(Boolean).join(' ');
  const interactive = clickable
    ? { onClick, role: 'button', tabIndex: 0, title }
    : { 'aria-hidden': 'true' };

  if (cfg) {
    const props = toPeepProps(cfg);
    const cls = [
      base,
      'avatar-peep',
      isFull ? 'avatar-peep-full' : 'avatar-peep-head',
      isBot ? 'avatar-bot' : '',
    ].filter(Boolean).join(' ');
    return (
      <div className={cls} style={style} {...interactive}>
        <Peep
          {...props}
          body={isFull ? props.body : undefined}
          viewBox={isFull ? FULL_VIEWBOX : HEAD_VIEWBOX}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    );
  }
  return (
    <div className={base} style={style} {...interactive}>
      {initial}
    </div>
  );
}
