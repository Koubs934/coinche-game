// Brief summary shown after a scenario is annotated and persisted. Two
// terminal actions: back to picker, or next scenario.
//
// V2.2 Phase 2C (2026-05-05): the "D'accord/Pas d'accord" modal and the
// rule-silent obligatory-note modal are gone. Match annotations skip the
// completion screen entirely (App.jsx auto-advances). Divergent and
// rule-silent annotations both land here and the Claude conversation
// opens unconditionally — the conversation replaces the modal as the
// reasoning-collection surface. Note section is rendered only when the
// user actually wrote one (which won't happen via the new flow, but
// pre-Phase 2C annotations on disk may still carry a note).
//
// V2.2 Phase 2 (2026-05-05): the auction recap is rendered above the card
// for every completion path — it's the permanent header per Phase 2A.
//
// v3.1 (2026-05-04): the post-submit "Autre stratégie possible ?" overlay
// was removed; every annotation auto-concludes server-side.
//
// v3 (2026-05-04): tag rendering removed.

import { useState } from 'react';
import { useLang } from '../context/LanguageContext';
import { formatActionText, actionIsRed } from './formatAction';
import ClaudeConversation from './ClaudeConversation';
import CardSelector from './CardSelector';
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
  caseType,
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

  // V2.2 Phase 2C — Claude opens for every divergent or rule-silent
  // annotation. Match never reaches CompletionSummary (App.jsx auto-
  // advances), but defensively gate on caseType so a stale match
  // annotation that does land here doesn't try to start a conversation
  // (the /start endpoint would 400 on a match anyway).
  const showConversation = (caseType === 'divergent' || caseType === 'rule-silent')
    && !!annotationFilename
    && !!userId;

  // V2.2 Phase 2C — card selection step that runs BEFORE the conversation
  // mounts. Divergent: at least one card required. Rule-silent: optional
  // (skip with "Continuer sans sélection"). After validation/skip we
  // remember the chosen cards and mount ClaudeConversation; ClaudeConversation
  // then posts to /select-cards or /start depending on whether the array
  // is empty.
  const [selectedCards,       setSelectedCards]       = useState(null); // null = not yet decided
  const [conversationClosed,  setConversationClosed]  = useState(false);

  // The user's hand sits in trainingRun.game.hands[userSeat] (only the
  // user's seat is populated; other seats are masked). Pull it for the
  // selector — and use the user's submitted bid suit as trump for the
  // sort order (so trump cards lead).
  const userSeat   = scenarioSnapshot?.myPosition ?? scenarioSnapshot?.trainingState?.userSeat;
  const userHand   = (userSeat != null) ? (scenarioSnapshot?.game?.hands?.[userSeat] || []) : [];
  const trumpSuit  = action?.type === 'bid' ? (action.suit ?? null) : null;

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

        {/* Note section only when the user actually wrote one. Phase 2C's
            new flow leaves the note empty; legacy annotations may still
            carry one. */}
        {note && (
          <section className="tc-section">
            <div className="tc-section-label">{c.noteLabel}</div>
            <div className="tc-note">{note}</div>
          </section>
        )}

        {showConversation && selectedCards === null && (
          <CardSelector
            hand={userHand}
            caseType={caseType}
            trumpSuit={trumpSuit}
            onSubmit={(cards) => setSelectedCards(cards)}
            onSkip={() => setSelectedCards([])}
          />
        )}

        {showConversation && selectedCards !== null && !conversationClosed && (
          <ClaudeConversation
            userId={userId}
            annotationFilename={annotationFilename}
            userName={userName}
            caseType={caseType}
            selectedCards={selectedCards}
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
