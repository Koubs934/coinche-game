// Full-screen modal that lets the room creator tag a card as a play error.
//
// V1 pause semantics are FRONTEND-ONLY: the overlay visually freezes the
// admin's game view (backdrop dim + modal on top) but does not block other
// players' actions on the backend. If the game advances while the overlay is
// open, the admin returns to an updated state — the tricks they saw when they
// opened are still in the past and still taggable.
//
// Trick selector: pills for every completed trick plus the in-progress one.
// Card grid: for the selected trick, the four (or fewer) played cards shown
// in play order — each card clickable. Selection highlights with an amber
// border; selected-card details render underneath for verification. Save is
// disabled until both a card and a non-empty note exist.

import { useMemo, useState } from 'react';
import { useLang } from '../context/LanguageContext';

const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };

function cardToString(card) {
  // Back end serializes cards as value+suit ("9H", "10D"). Mirror that here so
  // the string we send matches exactly what the server validates against.
  if (!card) return '';
  return `${card.value}${card.suit}`;
}

function cardLabel(card) {
  if (!card) return '';
  return `${card.value}${SUIT_SYM[card.suit] || card.suit}`;
}

function isRed(card) {
  return card && (card.suit === 'H' || card.suit === 'D');
}

export default function GameErrorTagOverlay({
  game,
  players,
  existingAnnotations,
  onSubmit,
  onCancel,
}) {
  const { t } = useLang();
  const tp = t.overlay.tagPlayError;

  // Group existing annotations by (trickIndex, seat, card) so each tagged card
  // can show its badge and compose a multi-note tooltip. Spec allows multiple
  // annotations on the same card; a badge just warns the admin so they don't
  // unknowingly double-tag — tagging another is still valid.
  const annotationsByKey = useMemo(() => {
    const map = new Map();
    for (const a of (existingAnnotations || [])) {
      const cr = a?.cardRef;
      if (!cr) continue;
      const key = `${cr.trickIndex}-${cr.seat}-${cr.card}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    }
    return map;
  }, [existingAnnotations]);

  // Tap-to-pin tooltip state so mobile (no hover) still reveals notes. Key =
  // same `${trickIdx}-${seat}-${card}` string used above. Null = nothing pinned;
  // hover CSS still reveals on desktop independently.
  const [pinnedBadge, setPinnedBadge] = useState(null);

  // Tricks available for tagging: every completed trick + (maybe) the
  // in-progress one if any card has been played in it.
  const tricks = useMemo(() => {
    const completed = (game?.tricks || []).map((trk, i) => ({
      index:       i,
      cards:       trk.cards,           // [{ card, playerIndex, playedAt? }]
      inProgress:  false,
    }));
    const curr = game?.currentTrick || [];
    if (curr.length > 0) {
      completed.push({
        index:      completed.length,
        cards:      curr,
        inProgress: true,
      });
    }
    return completed;
  }, [game?.tricks, game?.currentTrick]);

  const lastIdx = tricks.length > 0 ? tricks[tricks.length - 1].index : 0;
  const [trickIdx, setTrickIdx] = useState(lastIdx);
  const [selected, setSelected] = useState(null); // { trickIndex, seat, card:{value,suit} } | null
  const [note, setNote] = useState('');

  const activeTrick = tricks.find(t => t.index === trickIdx) || null;

  function handleSelect(seat, card) {
    setSelected({ trickIndex: trickIdx, seat, card });
  }

  function playerName(seat) {
    const p = (players || []).find(p => p.position === seat);
    return p?.username || `#${seat}`;
  }

  const canSave = !!selected && note.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    onSubmit({
      cardRef: {
        trickIndex: selected.trickIndex,
        seat:       selected.seat,
        card:       cardToString(selected.card),
      },
      note: note.trim(),
    });
  }

  return (
    <div
      className="game-error-overlay-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gerr-heading"
    >
      <div className="game-error-overlay-card">
        <h3 id="gerr-heading" className="game-error-overlay-heading">{tp.heading}</h3>

        {/* Trick selector pills */}
        <div className="game-error-overlay-trick-pills">
          {tricks.map(trk => {
            const label = trk.inProgress ? tp.currentTrick : tp.trickLabel(trk.index + 1);
            const active = trk.index === trickIdx;
            return (
              <button
                key={trk.index}
                type="button"
                className={`gerr-trick-pill${active ? ' on' : ''}${trk.inProgress ? ' gerr-trick-pill-inprogress' : ''}`}
                onClick={() => { setTrickIdx(trk.index); setSelected(null); setPinnedBadge(null); }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Card grid for the selected trick */}
        <div className="game-error-overlay-cards">
          {activeTrick && activeTrick.cards.map(({ card, playerIndex }, idx) => {
            const sel = selected
              && selected.trickIndex === trickIdx
              && selected.seat === playerIndex
              && selected.card?.suit === card.suit
              && selected.card?.value === card.value;
            const cardKey = `${trickIdx}-${playerIndex}-${cardToString(card)}`;
            const existing = annotationsByKey.get(cardKey);
            const tooltip = existing
              ? existing.map(a => a.note).join('\n\n')
              : null;
            const pinned = pinnedBadge === cardKey;
            return (
              <div
                key={`${idx}-${cardToString(card)}`}
                className={`gerr-card-wrap${pinned ? ' gerr-card-wrap-pinned' : ''}`}
              >
                <button
                  type="button"
                  className={`gerr-card${sel ? ' gerr-card-selected' : ''}${isRed(card) ? ' gerr-card-red' : ''}${existing ? ' gerr-card-tagged' : ''}`}
                  onClick={() => handleSelect(playerIndex, card)}
                >
                  <span className="gerr-card-face">{cardLabel(card)}</span>
                  <span className="gerr-card-seat">{playerName(playerIndex)}</span>
                </button>
                {existing && (
                  <button
                    type="button"
                    className="gerr-card-badge"
                    title={tooltip}
                    aria-label={tooltip}
                    onClick={(e) => {
                      // Stop propagation so clicking the badge doesn't also
                      // select the card underneath; pinned-tooltip toggling
                      // is the badge's only job.
                      e.stopPropagation();
                      setPinnedBadge(pinned ? null : cardKey);
                    }}
                  >
                    <span aria-hidden="true">●</span>
                  </button>
                )}
                {existing && (
                  // Always rendered when annotations exist. Visibility is
                  // driven by CSS: :hover on the wrap reveals it (desktop),
                  // and .gerr-card-wrap-pinned forces it visible (tap-pin
                  // on mobile). Native `title` on the badge is a third
                  // belt-and-braces affordance for assistive tech.
                  <div className="gerr-card-tooltip" role="tooltip">
                    {existing.map((a, i) => (
                      <div key={a.annotationId || i} className="gerr-card-tooltip-item">
                        {a.note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {activeTrick && activeTrick.cards.length === 0 && (
            <div className="gerr-card-empty">—</div>
          )}
        </div>

        {/* Card-selected verification strip */}
        {selected && (
          <p className="game-error-overlay-selected-label">
            {tp.cardSelected({
              trick:    selected.trickIndex + 1,
              username: playerName(selected.seat),
              seat:     selected.seat,
              card:     cardLabel(selected.card),
            })}
          </p>
        )}

        {/* Note input */}
        <textarea
          className="game-error-overlay-note"
          rows={4}
          maxLength={2000}
          placeholder={tp.notePlaceholder}
          value={note}
          onChange={e => setNote(e.target.value)}
        />

        {/* Actions */}
        <div className="game-error-overlay-actions">
          <button
            type="button"
            className="gerr-save"
            onClick={handleSave}
            disabled={!canSave}
          >
            {tp.saveBtn}
          </button>
          <button
            type="button"
            className="gerr-cancel"
            onClick={onCancel}
          >
            {tp.cancelBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
