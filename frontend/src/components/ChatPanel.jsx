import { useEffect, useRef, useState } from 'react';
import { useLang } from '../context/LanguageContext';

// Bottom-sheet conversation panel for the per-room table chat. Slides up over
// the table (which stays visible above it), mirroring the bid-sheet / settings
// overlay style. Stateless beyond its own scroll + input refs — message list,
// open flag and send are owned by App.jsx.
//
// teamForUser maps a userId → team (0|1) so each sender's name picks up its
// seat colour, matching the seat avatars on the felt.
export default function ChatPanel({ open, onClose, messages, myUserId, players, onSend }) {
  const { t } = useLang();
  const listRef  = useRef(null);
  const inputRef = useRef(null);
  // Keyboard offset: how much the on-screen keyboard overlaps the layout
  // viewport. We push the sheet up by this much so the input stays visible
  // on mobile (the sheet is anchored to the bottom of a fixed overlay).
  const [kbOffset, setKbOffset] = useState(0);

  function teamFor(userId) {
    return players?.find(p => p.userId === userId)?.team ?? null;
  }

  // Auto-scroll to the newest message on open and whenever a message arrives.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  // Focus the input when the sheet opens (deferred so the slide-in settles).
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(id);
  }, [open]);

  // Track the on-screen keyboard via the VisualViewport API and lift the sheet
  // so the input row never hides behind it. No-op where unsupported.
  useEffect(() => {
    if (!open || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbOffset(overlap);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setKbOffset(0);
    };
  }, [open]);

  function submit() {
    const el = inputRef.current;
    if (!el) return;
    const text = el.value.trim();
    if (!text) return;
    onSend(text);
    el.value = '';
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  if (!open) return null;

  return (
    <div className="chat-overlay" onClick={onClose}>
      <div
        className="chat-sheet"
        style={kbOffset ? { marginBottom: kbOffset } : undefined}
        onClick={e => e.stopPropagation()}
      >
        <div className="chat-sheet-header">
          <span className="chat-sheet-title">{t.chat.title}</span>
          <button className="btn-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="chat-message-list" ref={listRef}>
          {messages.length === 0 ? (
            <p className="chat-empty">{t.chat.empty}</p>
          ) : (
            messages.map(m => {
              const mine = m.userId === myUserId;
              const team = teamFor(m.userId);
              return (
                <div key={m.id} className={`chat-msg${mine ? ' chat-msg-mine' : ''}`}>
                  {!mine && (
                    <span className={`chat-msg-author${team != null ? ` team${team}-col` : ''}`}>
                      {m.username}
                    </span>
                  )}
                  <span className="chat-msg-text">{m.text}</span>
                </div>
              );
            })
          )}
        </div>

        <div className="chat-input-row">
          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            placeholder={t.chat.placeholder}
            maxLength={500}
            onKeyDown={handleKeyDown}
          />
          <button className="chat-send-btn" onClick={submit}>{t.chat.send}</button>
        </div>
      </div>
    </div>
  );
}
