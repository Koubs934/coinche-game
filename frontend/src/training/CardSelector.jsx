// V2.2 Phase 2C — card selector shown on the completion screen between
// the AuctionRecap header and the Claude conversation. The user taps
// cards from their own hand to highlight what motivated their bid; the
// selection feeds Claude's first question via /api/conversation/select-cards.
//
// Selection model: single group, tap to toggle. Order within the group is
// preserved as the order of taps (the FE doesn't sort), so the backend
// gets the user's mental order (sometimes meaningful — e.g. trump first
// then outside aces).
//
// Buttons:
//   DIVERGENT   → "Valider" only (disabled until ≥1 card selected)
//   RULE-SILENT → "Valider" (disabled until ≥1) + "Continuer sans sélection"

import { useState } from 'react';
import { useLang } from '../context/LanguageContext';

const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };

// Preferred display order: trump-rank for the user's bid suit, else canonical.
// We don't actually know which is "trump" here without threading caseType
// or the bid suit; for the picker we just sort canonical (S, H, D, C) by suit
// then trump-rank descending so Valets are first within each suit. Simpler
// and consistent with how the user just saw their hand on the table.
const SUIT_ORDER     = ['S', 'H', 'D', 'C'];
const NON_TRUMP_RANK = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'];
const TRUMP_RANK     = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];

function sortHandForSelector(hand, trumpSuit) {
  return [...hand].sort((a, b) => {
    const aTrump = trumpSuit && a.suit === trumpSuit;
    const bTrump = trumpSuit && b.suit === trumpSuit;
    if (aTrump !== bTrump) return aTrump ? -1 : 1;
    if (aTrump) return TRUMP_RANK.indexOf(a.value) - TRUMP_RANK.indexOf(b.value);
    const ds = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    if (ds !== 0) return ds;
    return NON_TRUMP_RANK.indexOf(a.value) - NON_TRUMP_RANK.indexOf(b.value);
  });
}

function cardKey(c) { return `${c.value}-${c.suit}`; }

export default function CardSelector({ hand, caseType, trumpSuit, onSubmit, onSkip }) {
  const { t } = useLang();
  const cs = t.training.cardSelector;

  // Selection: ordered array of card keys (preserves tap order).
  const [selectedKeys, setSelectedKeys] = useState([]);

  const sorted = sortHandForSelector(hand || [], trumpSuit);
  const isRuleSilent = caseType === 'rule-silent';

  function toggle(key) {
    setSelectedKeys(prev => prev.includes(key)
      ? prev.filter(k => k !== key)
      : [...prev, key]);
  }

  function handleValidate() {
    if (selectedKeys.length === 0) return;
    const selected = selectedKeys
      .map(k => sorted.find(c => cardKey(c) === k))
      .filter(Boolean)
      .map(c => ({ value: c.value, suit: c.suit }));
    onSubmit(selected);
  }

  function handleSkip() {
    onSkip?.();
  }

  return (
    <div className="card-selector">
      <div className="cs-heading">{cs.heading}</div>
      <div className="cs-hint">
        {isRuleSilent ? cs.hintRuleSilent : cs.hintDivergent}
      </div>

      <div className="cs-cards">
        {sorted.map(c => {
          const key   = cardKey(c);
          const on    = selectedKeys.includes(key);
          const isRed = c.suit === 'H' || c.suit === 'D';
          return (
            <button
              key={key}
              type="button"
              className={`cs-card${on ? ' cs-card-on' : ''}${isRed ? ' cs-card-red' : ''}`}
              onClick={() => toggle(key)}
              aria-pressed={on}
            >
              <span className="cs-card-value">{c.value}</span>
              <span className="cs-card-suit">{SUIT_SYM[c.suit]}</span>
            </button>
          );
        })}
      </div>

      <div className="cs-count">{cs.countLabel(selectedKeys.length)}</div>

      <div className="cs-actions">
        <button
          type="button"
          className="btn-primary cs-validate"
          onClick={handleValidate}
          disabled={selectedKeys.length === 0}
        >
          {cs.validateBtn}
        </button>
        {isRuleSilent && (
          <button
            type="button"
            className="btn-secondary cs-skip"
            onClick={handleSkip}
          >
            {cs.skipBtn}
          </button>
        )}
      </div>
    </div>
  );
}
