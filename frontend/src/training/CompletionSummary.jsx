// Brief summary shown after a scenario is annotated and persisted. Two
// terminal actions: back to picker, or next scenario.
//
// V2.2 Phase 2 (2026-05-05): when the user submitted with
// divergenceAgreement === 'user-disagrees' AND we have an annotationFilename,
// render the inline Claude conversation below the summary card. A compact
// scenario snapshot (hand + bidding history) is rendered above the card so
// the user keeps the context they were just looking at — per the V2.2 spec
// the conversation should not replace the scenario view.
//
// v3.1 (2026-05-04): the post-submit "Autre stratégie possible ?" overlay
// was removed; every annotation auto-concludes server-side. The
// pendingReview / onReviewContinue / onReviewEnd props are gone, and so
// is the ReviewPromptOverlay component.
//
// v3 (2026-05-04): tag rendering removed. The annotation now contains only
// action + divergenceType + divergenceAgreement + note. We render the
// action and the note (if present); the divergence machinery is plumbed
// through but not surfaced — users don't need to see "you matched the
// rule / you diverged" framing on the success screen.

import { useState } from 'react';
import { useLang } from '../context/LanguageContext';
import { formatActionText, actionIsRed } from './formatAction';
import ClaudeConversation from './ClaudeConversation';

const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SUIT_RED    = { H: true,  D: true };

function ScenarioContext({ scenarioSnapshot, userName, t }) {
  // Compact recap of the hand + bidding history. Kept tiny because the
  // primary surface is the conversation below; this is just a memory aid.
  const game     = scenarioSnapshot?.game;
  const userSeat = scenarioSnapshot?.myPosition ?? scenarioSnapshot?.trainingState?.userSeat;
  if (!game || userSeat == null) return null;

  const hand = (game.hands?.[userSeat] || []).filter(c => c && c.suit && c.value);
  const grouped = { S: [], H: [], D: [], C: [] };
  for (const c of hand) if (grouped[c.suit]) grouped[c.suit].push(c.value);

  // biddingHistory entries have shape { position, type, value?, suit? }.
  const bidEvents = (game.biddingHistory || []).filter(e => e && typeof e.type === 'string');

  const cc = t.training.claudeConversation;
  return (
    <div className="claude-context-card">
      <div className="cc-context-section">
        <div className="cc-context-label">{cc.contextHand}</div>
        <div className="cc-context-hand">
          {['S', 'H', 'D', 'C'].map(s => grouped[s].length > 0 && (
            <span key={s} className={`cc-context-suit${SUIT_RED[s] ? ' cc-context-red' : ''}`}>
              <span className="cc-context-suit-symbol">{SUIT_SYMBOL[s]}</span>
              <span>{grouped[s].join(' ')}</span>
            </span>
          ))}
        </div>
      </div>
      {bidEvents.length > 0 && (
        <div className="cc-context-section">
          <div className="cc-context-label">{cc.contextBidding}</div>
          <div className="cc-context-bids">
            {bidEvents.map((e, i) => {
              const role = e.position === userSeat
                ? userName
                : e.position === (userSeat + 2) % 4 ? '⤢' : '✕';
              if (e.type === 'pass')       return <span key={i} className="cc-bid">{role}: pass</span>;
              if (e.type === 'coinche')    return <span key={i} className="cc-bid">{role}: coinche</span>;
              if (e.type === 'surcoinche') return <span key={i} className="cc-bid">{role}: surcoinche</span>;
              if (e.type === 'bid') {
                return (
                  <span key={i} className={`cc-bid${SUIT_RED[e.suit] ? ' cc-context-red' : ''}`}>
                    {role}: {e.value} {SUIT_SYMBOL[e.suit] || ''}
                  </span>
                );
              }
              return <span key={i} className="cc-bid">{role}: {e.type}</span>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CompletionSummary({
  annotation,
  annotationFilename,
  userId,
  userName,
  scenarioSnapshot,
  onBackToPicker,
  onNextScenario,
  hasNextScenario,
}) {
  const { t } = useLang();
  const c = t.training.completion;

  const decision = annotation?.decisions?.[0];
  const action   = decision?.action;
  const note     = decision?.note ?? '';
  const showConversation = decision?.divergenceAgreement === 'user-disagrees'
    && !!annotationFilename
    && !!userId;

  const [conversationClosed, setConversationClosed] = useState(false);

  const actionText = formatActionText(action, t);
  const actionRed  = actionIsRed(action);

  return (
    <div className="training-completion">
      <div className="training-completion-card">
        <div className="tc-title-row">
          <h1>{c.title}</h1>
        </div>

        {showConversation && scenarioSnapshot && (
          <ScenarioContext scenarioSnapshot={scenarioSnapshot} userName={userName} t={t} />
        )}

        <section className="tc-section">
          <div className="tc-section-label">{c.actionLabel}</div>
          <div className={`tc-action${actionRed ? ' tc-red' : ''}`}>{actionText}</div>
        </section>

        <section className="tc-section">
          <div className="tc-section-label">{c.noteLabel}</div>
          {note ? (
            <div className="tc-note">{note}</div>
          ) : (
            <div className="tc-empty">{c.noNote}</div>
          )}
        </section>

        {showConversation && !conversationClosed && (
          <ClaudeConversation
            userId={userId}
            annotationFilename={annotationFilename}
            userName={userName}
            onClose={() => setConversationClosed(true)}
          />
        )}

        <div className="tc-actions">
          <button className="btn-secondary" onClick={onBackToPicker}>
            {c.backToPicker}
          </button>
          {hasNextScenario && (
            <button className="btn-primary" onClick={onNextScenario}>
              {c.nextScenario} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
