// localStorage persistence for in-flight reason-panel annotations.
//
// Why: the authoritative partial lives on disk server-side, but it's written
// at action-submit time — it captures the action, NOT the user's evolving
// note and tag selection. If the session is interrupted (server restart,
// socket drop, UNKNOWN_TRAINING_RUN redirect) while the user is mid-writing,
// the note they've typed is lost unless we mirror it locally.
//
// Keying: the partialId is stable across a single annotation lifecycle
// (including undo-and-retry and resume). Using it as the draft key means
// the resume flow finds the saved note automatically.

const PREFIX = 'training:note-draft:';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function safeLocalStorage() {
  try { return window.localStorage; } catch { return null; }
}

function keyFor(draftKey) {
  return PREFIX + String(draftKey);
}

/**
 * @returns {{ tags: string[], note: string, ts: number } | null}
 */
export function readDraft(draftKey) {
  if (!draftKey) return null;
  const ls = safeLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(keyFor(draftKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      note: typeof parsed.note === 'string' ? parsed.note : '',
      ts:   typeof parsed.ts   === 'number' ? parsed.ts   : 0,
    };
  } catch {
    return null;
  }
}

export function writeDraft(draftKey, tags, note) {
  if (!draftKey) return;
  const ls = safeLocalStorage();
  if (!ls) return;
  // Skip noise: empty tags + empty note = nothing to save.
  const cleanTags = Array.isArray(tags) ? tags : [];
  const cleanNote = typeof note === 'string' ? note : '';
  if (cleanTags.length === 0 && cleanNote.trim() === '') {
    clearDraft(draftKey);
    return;
  }
  try {
    ls.setItem(keyFor(draftKey), JSON.stringify({
      tags: cleanTags,
      note: cleanNote,
      ts:   Date.now(),
    }));
  } catch {
    // Quota exceeded or serialization failure — ignore silently; the draft
    // is a best-effort convenience, not a correctness guarantee.
  }
}

export function clearDraft(draftKey) {
  if (!draftKey) return;
  const ls = safeLocalStorage();
  if (!ls) return;
  try { ls.removeItem(keyFor(draftKey)); } catch {}
}

/**
 * Called once at app startup — remove any draft entries older than 24 h.
 * Don't let localStorage accumulate forever.
 */
export function cleanupOldDrafts() {
  const ls = safeLocalStorage();
  if (!ls) return;
  const cutoff = Date.now() - MAX_AGE_MS;
  const toRemove = [];
  try {
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      try {
        const rec = JSON.parse(ls.getItem(k) || '{}');
        if (!rec || typeof rec.ts !== 'number' || rec.ts < cutoff) toRemove.push(k);
      } catch {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) ls.removeItem(k);
  } catch {}
}
