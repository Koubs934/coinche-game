// V2.2 Phase 2 — Inline Claude conversation that opens after a "Pas d'accord"
// annotation submit. Talks to backend HTTP endpoints (Phase 1):
//
//   POST /api/conversation/start  on mount
//   POST /api/conversation/turn   on each user message
//   POST /api/conversation/end    on close (skip vs completed)
//
// State is intentionally minimal — the annotation file on disk is the source
// of truth, the component only mirrors the visible message stream. If a
// network call fails the component shows a retry affordance and does NOT
// drop the typed-but-unsent user message.

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../context/LanguageContext';

const API_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

async function postJson(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* leave null */ }
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

export default function ClaudeConversation({ userId, annotationFilename, userName, onClose }) {
  const { t } = useLang();
  const cc = t.training.claudeConversation;

  // messages: { role: 'claude' | 'user', content }
  const [messages,   setMessages]   = useState([]);
  const [draft,      setDraft]      = useState('');
  const [phase,      setPhase]      = useState('starting');
  // phase ∈ 'starting' | 'idle' | 'sending' | 'error-start' | 'error-turn' | 'closing' | 'closed'
  const [errorMsg,   setErrorMsg]   = useState('');

  const scrollRef    = useRef(null);
  const textareaRef  = useRef(null);
  const startedRef   = useRef(false);  // strict-mode guard — only fire /start once

  // ── /start on mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const data = await postJson('/api/conversation/start', { userId, annotationFilename });
        setMessages([{ role: 'claude', content: data.message }]);
        setPhase('idle');
      } catch (err) {
        setErrorMsg(err.message || cc.errorRetry);
        setPhase('error-start');
      }
    })();
  }, [userId, annotationFilename, cc.errorRetry]);

  // ── Auto-scroll on new messages / phase changes ────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, phase]);

  async function sendTurn(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Optimistic append. If the request fails we keep the user message
    // visible and surface a retry — losing what the user typed is worse
    // than a duplicate on a retry.
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setDraft('');
    setPhase('sending');
    setErrorMsg('');

    try {
      const data = await postJson('/api/conversation/turn', {
        userId, annotationFilename, userMessage: trimmed,
      });
      setMessages(prev => [...prev, { role: 'claude', content: data.message }]);
      setPhase('idle');
    } catch (err) {
      setErrorMsg(err.message || cc.errorRetry);
      setPhase('error-turn');
    }
  }

  function retryStart() {
    startedRef.current = false;
    setPhase('starting');
    setErrorMsg('');
    // Re-run effect by toggling a bogus state? Easier: replicate the call here.
    (async () => {
      try {
        const data = await postJson('/api/conversation/start', { userId, annotationFilename });
        setMessages([{ role: 'claude', content: data.message }]);
        setPhase('idle');
      } catch (err) {
        setErrorMsg(err.message || cc.errorRetry);
        setPhase('error-start');
      }
    })();
  }

  function retryLastTurn() {
    // Last message in `messages` is the user's optimistically-appended text
    // that we never got a reply for. Pull it back, set as draft, drop from
    // messages, retry through the normal send path.
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user') {
      setPhase('idle');
      setErrorMsg('');
      return;
    }
    setMessages(prev => prev.slice(0, -1));
    setPhase('idle');
    setErrorMsg('');
    sendTurn(last.content);
  }

  async function handleEnd() {
    if (phase === 'closing' || phase === 'closed') return;
    setPhase('closing');
    const hasUserMsg = messages.some(m => m.role === 'user');
    const reason = hasUserMsg ? 'completed' : 'skip';
    try {
      await postJson('/api/conversation/end', { userId, annotationFilename, reason });
    } catch {
      // Best-effort close — don't trap the user if the end call fails.
    }
    setPhase('closed');
    onClose?.();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (phase === 'idle') sendTurn(draft);
    }
  }

  const inputDisabled = phase !== 'idle';
  const showStartLoader = phase === 'starting';
  const showTurnLoader  = phase === 'sending';
  const showStartError  = phase === 'error-start';
  const showTurnError   = phase === 'error-turn';

  return (
    <div className="claude-conversation">
      <div className="claude-conversation-header">
        <span>{cc.heading}</span>
        <button
          type="button"
          className="btn-link claude-end-btn"
          onClick={handleEnd}
          disabled={phase === 'closing' || phase === 'closed'}
        >
          {cc.endBtn}
        </button>
      </div>

      <div className="claude-messages" ref={scrollRef}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`claude-message ${m.role === 'claude' ? 'from-claude' : 'from-user'}`}
          >
            <span className="claude-message-author">
              {m.role === 'claude' ? cc.authorClaude : userName}
            </span>
            <span className="claude-message-body">{m.content}</span>
          </div>
        ))}

        {showStartLoader && (
          <div className="claude-loading">{cc.loadingFirst}</div>
        )}
        {showTurnLoader && (
          <div className="claude-loading">{cc.loadingTurn}</div>
        )}
        {showStartError && (
          <div className="claude-error">
            <div>{errorMsg || cc.errorRetry}</div>
            <button type="button" className="btn-secondary" onClick={retryStart}>
              {cc.retryBtn}
            </button>
          </div>
        )}
        {showTurnError && (
          <div className="claude-error">
            <div>{errorMsg || cc.errorRetry}</div>
            <button type="button" className="btn-secondary" onClick={retryLastTurn}>
              {cc.retryBtn}
            </button>
          </div>
        )}
      </div>

      <div className="claude-input">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={cc.inputPlaceholder}
          disabled={inputDisabled}
          rows={2}
          maxLength={2000}
        />
        <button
          type="button"
          className="btn-primary claude-send-btn"
          onClick={() => sendTurn(draft)}
          disabled={inputDisabled || !draft.trim()}
        >
          {cc.sendBtn}
        </button>
      </div>
    </div>
  );
}
