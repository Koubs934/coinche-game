// Dev-only environment indicator. Renders a small fixed-position "LOCAL" badge
// when the frontend is loaded from localhost or a LAN IP, so it's visually
// obvious which backend the UI is talking to. Nothing renders on production.

export default function EnvBadge() {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.');
  if (!isLocal) return null;
  return <div className="env-badge">LOCAL</div>;
}
