// V2.2 Phase 2 — Inline Claude conversation that opens after a "Pas d'accord"
// annotation submit. Talks to backend HTTP endpoints (Phase 1):
//
//   POST /api/conversation/start  on mount
//   POST /api/conversation/turn   on each user message
//   POST /api/conversation/end    on close — three reason paths:
//     'completed'  : user clicked "Terminer la discussion" with ≥1 msg
//     'skip'       : user clicked "Terminer la discussion" with 0 msg
//     'navigation' : component unmounted (Scénario suivant / Retour aux
//                    scénarios) without an explicit close
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

// V2.2 Phase 2C — when CompletionSummary's CardSelector returns a non-empty
// `selectedCards` array, we POST to /api/conversation/select-cards instead
// of /api/conversation/start. The two endpoints share the response shape
// ({ message, usage }); /select-cards additionally feeds the cards into
// Claude's first system prompt + user message. An empty array (the
// rule-silent "skip" path) falls through to plain /start.
//
// `caseType` is accepted for forward-compat (different placeholders later)
// but the backend already reads caseType from the annotation file.
export default function ClaudeConversation({ userId, annotationFilename, userName, caseType, selectedCards, onClose }) { // eslint-disable-line no-unused-vars
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
  // V2.2 follow-up: track whether /start (or /select-cards) actually
  // returned a Claude opening, and whether /end has already been fired
  // by handleEnd. The unmount cleanup uses both to decide whether to
  // fire /end with reason:'navigation'. Refs persist across React 18
  // StrictMode's dev double-mount on the same component instance.
  const startedSucceededRef = useRef(false);
  const endedRef            = useRef(false);
  // Holds the deferred-end timer id so a same-tick remount (StrictMode)
  // can cancel it before it actually fires the fetch.
  const endTimeoutRef       = useRef(null);

  // V2.2 Phase 2C — pick the right opener: /select-cards if the user picked
  // any, otherwise /start. We freeze the choice on mount so React StrictMode's
  // double-render doesn't fire the API twice.
  const hasSelection = Array.isArray(selectedCards) && selectedCards.length > 0;
  const openEndpoint = hasSelection ? '/api/conversation/select-cards' : '/api/conversation/start';
  const openBody     = hasSelection
    ? { userId, annotationFilename, selectedCards }
    : { userId, annotationFilename };

  // ── start (or select-cards) on mount ───────────────────────────────────
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const data = await postJson(openEndpoint, openBody);
        setMessages([{ role: 'claude', content: data.message }]);
        setPhase('idle');
        startedSucceededRef.current = true;
      } catch (err) {
        setErrorMsg(err.message || cc.errorRetry);
        setPhase('error-start');
      }
    })();
    // openEndpoint / openBody are derived from props that don't change
    // during the lifetime of the component, so a single fire is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── unmount cleanup: auto-end the conversation on navigation ───────────
  // When the user clicks "Scénario suivant" or "Retour aux scénarios"
  // without first clicking "Terminer la discussion", this fires
  // /api/conversation/end with reason:'navigation' so the annotation
  // file's ended_at gets set. Without this, re-opening the same
  // annotation later is blocked by the "already started" guard.
  //
  // StrictMode dev double-mount handling: cleanup defers the actual
  // fetch via setTimeout(100ms) and stashes the timer id in
  // endTimeoutRef. On the very next setup invocation (the StrictMode
  // remount), we clear that timer — so the deferred end never fires
  // for a "fake" cleanup. On a real unmount, no remount cancels it
  // and /end fires after 100ms.
  useEffect(() => {
    if (endTimeoutRef.current) {
      clearTimeout(endTimeoutRef.current);
      endTimeoutRef.current = null;
    }
    return () => {
      endTimeoutRef.current = setTimeout(() => {
        endTimeoutRef.current = null;
        // Skip if /start never produced an opening — there's no
        // conversation on disk to close.
        if (!startedSucceededRef.current) return;
        // Skip if handleEnd already closed the conversation (the
        // backend is idempotent so a double-fire wouldn't corrupt
        // anything, but skipping avoids the network round-trip).
        if (endedRef.current) return;
        fetch(`${API_URL}/api/conversation/end`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            userId,
            annotationFilename,
            reason: 'navigation',
          }),
        }).catch(() => {});  // best-effort; don't block unmount
      }, 100);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    (async () => {
      try {
        const data = await postJson(openEndpoint, openBody);
        setMessages([{ role: 'claude', content: data.message }]);
        setPhase('idle');
        startedSucceededRef.current = true;
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
    // Mark ended BEFORE the await so the unmount cleanup that fires when
    // onClose() removes us from the tree skips the redundant /end call.
    endedRef.current = true;
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
