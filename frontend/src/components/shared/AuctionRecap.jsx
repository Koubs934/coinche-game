// Shared mini-table auction recap. Used by:
//   - RoundSummary.jsx → end-of-round summary (with `initialHands` so each
//     seat shows its sorted hand strip below the chips).
//   - CompletionSummary.jsx (V2.2 Phase 2) → after a "Pas d'accord"
//     annotation, to keep the bidding context visible alongside Claude's
//     conversation.
//
// Renders the standard 2x2 seat grid (top, left+felt+right, bottom-self)
// with per-seat bid chips, the ENTAME badge on the first bidder, and the
// winning-bid highlight. Coinche / surcoinche chips get their own colours.
//
// Container reuses the same `.auction-recap` / `.ar-*` / `.hand-strip`
// classes as RoundSummary so visual styling stays in App.css and the two
// callers render identically.
//
// Children (optional): rendered inside the .auction-recap container after
// the seat grid. RoundSummary uses this slot for the "Rejouer" nav so the
// button stays inside the flex column (and inherits the 4px gap) instead
// of jumping out as a sibling.
//
// V2.2 Phase 2D — `centerHand` (optional): when set, the user's 8 cards
// are drawn as 2x4 mini-cards inside the green felt oval. Used by
// CompletionSummary as a memory aid during the Claude conversation.
// Caller is responsible for sort order (export `sortHandByTrump` below
// is available for callers that want trump-first sort to match the
// round-end HandStrip). RoundSummary doesn't pass centerHand → felt
// stays empty as today, no regression.

import { useLang } from '../../context/LanguageContext';

const SUIT_SYM       = { S: '♠', H: '♥', D: '♦', C: '♣' };
const TRUMP_RANK     = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];
const NON_TRUMP_RANK = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'];
const SUIT_ORDER     = ['S', 'H', 'D', 'C'];

// Sort a hand for display: trump cards first (in trump-rank order), then
// the other 3 suits in canonical order, each in non-trump rank order.
// Exported so CompletionSummary (Phase 2D centerHand) can match the
// trump-aware sort used by HandStrip without duplicating the helper.
export function sortHandByTrump(hand, trump) {
  return [...hand].sort((a, b) => {
    const aTrump = a.suit === trump;
    const bTrump = b.suit === trump;
    if (aTrump !== bTrump) return aTrump ? -1 : 1;
    if (aTrump) return TRUMP_RANK.indexOf(a.value) - TRUMP_RANK.indexOf(b.value);
    const suitDiff = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return NON_TRUMP_RANK.indexOf(a.value) - NON_TRUMP_RANK.indexOf(b.value);
  });
}

// Per-seat atout used to sort the displayed initial hand at round end:
//   - Taker and partner: sorted by the contract trump
//   - Opponent who bid:  sorted by the suit of their LAST bid
//   - Opponent who only passed: sorted by the contract trump (fallback)
function getAtoutForSeat(position, currentBid, biddingHistory) {
  if (!currentBid) return null;
  const takerPos   = currentBid.playerIndex;
  const partnerPos = (takerPos + 2) % 4;
  if (position === takerPos || position === partnerPos) return currentBid.suit;
  let lastBid = null;
  for (const e of (biddingHistory || [])) {
    if (e.position === position && e.type === 'bid') lastBid = e;
  }
  return lastBid ? lastBid.suit : currentBid.suit;
}

function HandStrip({ hand, trump }) {
  if (!Array.isArray(hand) || hand.length !== 8) return null;
  if (hand.some(c => !c || !c.suit || !c.value))  return null; // masked seat
  const sorted = sortHandByTrump(hand, trump);
  return (
    <div className="hand-strip">
      {sorted.map((c, i) => {
        const isRed = c.suit === 'H' || c.suit === 'D';
        return (
          <span key={i} className={`hand-strip-card ${isRed ? 'red' : 'black'}`}>
            {c.value}{SUIT_SYM[c.suit]}
          </span>
        );
      })}
    </div>
  );
}

export default function AuctionRecap({
  players,
  biddingHistory,
  currentBid,
  myPosition,
  trumpSuit, // eslint-disable-line no-unused-vars
  initialHands,
  centerHand,
  children,
}) {
  const { t } = useLang();

  function nameAt(pos) {
    return players?.find(p => p.position === pos)?.username || '?';
  }

  const topPos   = (myPosition + 2) % 4;
  const leftPos  = (myPosition + 3) % 4;
  const rightPos = (myPosition + 1) % 4;

  const perPlayer = { 0: [], 1: [], 2: [], 3: [] };
  for (const entry of (biddingHistory || [])) {
    if (perPlayer[entry.position]) perPlayer[entry.position].push(entry);
  }
  const firstBidderPos = (biddingHistory || [])[0]?.position ?? null;

  function SeatContent({ pos }) {
    const isFirst = pos === firstBidderPos;
    const actions = [...perPlayer[pos]].reverse();
    const seatHand  = initialHands?.[pos];
    const seatTrump = currentBid && seatHand ? getAtoutForSeat(pos, currentBid, biddingHistory) : null;
    return (
      <>
        {isFirst && <span className="ar-first-badge">{t.trickLead}</span>}
        {actions.length > 0 && (
          <div className="ar-stack">
            {actions.map((entry, i) => {
              const isWinningBid =
                entry.type === 'bid' &&
                pos === currentBid?.playerIndex &&
                entry.value === currentBid?.value &&
                entry.suit  === currentBid?.suit;
              const isRed = entry.suit === 'H' || entry.suit === 'D';
              let label;
              if      (entry.type === 'pass')        label = t.pass;
              else if (entry.type === 'coinche')     label = t.coinched;
              else if (entry.type === 'surcoinche')  label = t.surcoinched;
              else label = entry.value === 'capot' ? t.capot : `${entry.value} ${SUIT_SYM[entry.suit]}`;
              let cls = 'ar-action';
              if      (entry.type === 'surcoinche')  cls += ' ar-surcoinche';
              else if (entry.type === 'coinche')     cls += ' ar-coinche';
              else if (isWinningBid)                 cls += ` ar-win${isRed ? ' red' : ''}`;
              else if (entry.type === 'pass')        cls += ' ar-pass';
              else if (i === 0)                      cls += ` ar-latest${isRed ? ' red' : ''}`;
              else                                   cls += ' ar-old';
              return <span key={i} className={cls}>{label}</span>;
            })}
          </div>
        )}
        {seatHand && seatTrump && <HandStrip hand={seatHand} trump={seatTrump} />}
      </>
    );
  }

  function Seat({ pos, isMe }) {
    return (
      <div className="ar-seat">
        <span className="ar-name">{nameAt(pos)}{isMe ? ` (${t.you})` : ''}</span>
        <SeatContent pos={pos} />
      </div>
    );
  }

  return (
    <div className="auction-recap">
      <div className="ta-header">
        <span className="ta-mode-label">{t.biddingPhase}</span>
      </div>
      <div className="ar-top-row"><Seat pos={topPos} /></div>
      <div className="ar-mid-row">
        <Seat pos={leftPos} />
        <div className="ar-table-felt">
          {Array.isArray(centerHand) && centerHand.length > 0 && (
            <div className="ar-table-felt-cards">
              <div className="ar-table-felt-cards-row">
                {centerHand.slice(0, 4).map((card, i) => {
                  const isRed = card.suit === 'H' || card.suit === 'D';
                  return (
                    <span key={i} className={`ar-table-felt-card ${isRed ? 'red' : 'black'}`}>
                      <span>{card.value}</span>
                      <span>{SUIT_SYM[card.suit]}</span>
                    </span>
                  );
                })}
              </div>
              <div className="ar-table-felt-cards-row">
                {centerHand.slice(4, 8).map((card, i) => {
                  const isRed = card.suit === 'H' || card.suit === 'D';
                  return (
                    <span key={i + 4} className={`ar-table-felt-card ${isRed ? 'red' : 'black'}`}>
                      <span>{card.value}</span>
                      <span>{SUIT_SYM[card.suit]}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <Seat pos={rightPos} />
      </div>
      <div className="ar-bot-row"><Seat pos={myPosition} isMe /></div>
      {children}
    </div>
  );
}
