// Brief summary shown after a scenario is annotated and persisted. Two
// terminal actions: back to picker, or next scenario.
//
// V2.2 Phase 2 (2026-05-05): the auction recap is rendered above the card
// for every completion path (match, divergent, rule-silent) — it's the
// permanent header per the Phase 2A spec. When the user also submitted
// with divergenceAgreement === 'user-disagrees' AND we have an
// annotationFilename, the inline Claude conversation opens below the
// action/note sections.
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
import AuctionRecap from '../components/shared/AuctionRecap';

// Build a synthetic 4-player array (positions 0..3) for AuctionRecap with
// labels relative to the user's seat: self → t.you, +2 → t.partner, +1/+3
// → t.opponent. The training-mode publicView already includes a `room.players`
// array but its scripted seats carry `username: null`, which would render
// as '?' in AuctionRecap — relabelling here keeps the recap readable.
function buildPlayersForRecap(userSeat, t) {
  return [0, 1, 2, 3].map(pos => {
    const offset = (pos - userSeat + 4) % 4;
    let username;
    if      (offset === 0) username = t.you;
    else if (offset === 2) username = t.partner;
    else                   username = t.opponent;
    return { position: pos, username, team: pos % 2, isBot: pos !== userSeat };
  });
}

function ScenarioContextRecap({ scenarioSnapshot, fallbackAction, t }) {
  const game     = scenarioSnapshot?.game;
  const userSeat = scenarioSnapshot?.myPosition ?? scenarioSnapshot?.trainingState?.userSeat;
  if (!game || userSeat == null) return null;

  // Defensive fallback: if biddingHistory is empty (shouldn't happen in
  // normal flow — _applyBid/_applyPass push to it during submitTrainingAction)
  // but the user did submit an action, synthesize a single-entry history so
  // the user's bid still shows up as a chip on their seat.
  let biddingHistory = game.biddingHistory;
  if ((!biddingHistory || biddingHistory.length === 0) && fallbackAction) {
    biddingHistory = [{
      position: userSeat,
      type:     fallbackAction.type,
      value:    fallbackAction.value,
      suit:     fallbackAction.suit,
    }];
  }

  return (
    <div className="completion-summary-recap">
      <AuctionRecap
        players={buildPlayersForRecap(userSeat, t)}
        biddingHistory={biddingHistory}
        currentBid={game.currentBid}
        myPosition={userSeat}
        trumpSuit={game.trumpSuit}
      />
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

        {scenarioSnapshot && (
          <ScenarioContextRecap
            scenarioSnapshot={scenarioSnapshot}
            fallbackAction={action}
            t={t}
          />
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
