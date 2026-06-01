import { useLayoutEffect, useMemo, useRef } from 'react';
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
//   • variant="full" — the whole figure (Profile preview, waiting room, builder).
//                      Poses span wildly different sizes (a seated WheelChair is
//                      ~3× the width of a bust), so we MEASURE the rendered
//                      figure's bbox and frame the viewBox to it — every pose
//                      fills its box, nothing clipped, no hand-tuned per-pose box.
//   • variant="head" — head-only crop (in-game seats, lobby strip, friends, throw
//                      targets). We omit the body and zoom the viewBox to the head,
//                      which sits at a fixed position regardless of pose.
//
// `circleClassName` carries the per-call-site styling (e.g. "player-avatar
// team0-avatar", "friend-avatar") so the fallback keeps its look and a colored
// backdrop can show behind the figure. `size` (px) overrides the class size.

// The head sits at a fixed spot in react-peeps' 850×1200 figure (the head <g> is
// translate(225 0) independent of body pose), so one crop frames every face
// (long hair / buns crop at the edge, as expected).
const HEAD_VIEWBOX = { x: 240, y: 18, width: 470, height: 470 };
// A safe initial frame for the full figure before the measured bbox lands; the
// layout effect below replaces it (so first paint is never broken).
const FULL_VIEWBOX = { x: -230, y: -50, width: 1320, height: 3080 };

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

  const isFull = variant === 'full';
  const wrapRef = useRef(null);

  // Full figure: frame the viewBox to the figure's own geometry so every pose
  // fills its box. Runs before paint; re-measures when the figure changes.
  useLayoutEffect(() => {
    if (!isFull || !cfg) return;
    const svg = wrapRef.current?.querySelector('svg');
    const g = svg?.querySelector('g');
    if (!g) return;
    let bb;
    try { bb = g.getBBox(); } catch { return; }
    if (!bb || !bb.width || !bb.height) return;
    const padX = bb.width * 0.06;
    const padY = bb.height * 0.04;
    svg.setAttribute('viewBox', `${bb.x - padX} ${bb.y - padY} ${bb.width + padX * 2} ${bb.height + padY * 2}`);
  }, [isFull, cfg && JSON.stringify(cfg)]);

  const style = { ...(size ? { width: size, height: size } : null), ...circleStyle };
  const clickable = typeof onClick === 'function';
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
      <div ref={wrapRef} className={cls} style={style} {...interactive}>
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
