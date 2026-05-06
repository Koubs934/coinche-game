// Anthropic API wrapper for V2.2 Claude conversational annotation flow.
// All calls to the Anthropic API live in this module. Callers (server.js
// endpoints) build context, then invoke startConversation / continueConversation
// and persist the result.
//
// ANTHROPIC_API_KEY must be set at runtime. The client itself doesn't read the
// env var until first call, so unit tests that don't hit the API can require
// this module without configuring a key.

const Anthropic = require('@anthropic-ai/sdk');
const { describePatterns, describeSelectedCards } = require('../game/cardFeatures');

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };

let _client = null;
function getClient() {
  if (_client) return _client;
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

function buildSystemPrompt({ feuilleContent, userName, userPastAnnotations, caseType, cardSelection }) {
  // V2.2 Phase 2C: the CONTEXTE paragraph adapts to caseType so Claude
  // doesn't accuse a rule-silent annotator of "diverging from the rule"
  // (there is no rule). Default to the divergent framing for backward
  // compat with the smoke-test script and any caller that doesn't pass
  // caseType explicitly.
  const contexte = caseType === 'rule-silent'
    ? `L'utilisateur s'appelle ${userName}. Il vient de faire une annotation
sur un cas que la Feuille V2.1 ne couvre pas explicitement. Il a fait
un choix et le justifie — son raisonnement va aider à compléter la
Feuille.`
    : `L'utilisateur s'appelle ${userName}. Il vient de faire une annotation
"Pas d'accord" — il a annoncé une valeur différente de ce que la Feuille
V2.1 prescrit, et il défend explicitement son choix.`;

  return `Tu es Claude, un assistant conversationnel pour annoter des décisions de coinche.

RÔLE
Tu joues le rôle d'un détective socratique. Tu poses des questions précises
pour révéler le raisonnement implicite de l'annotateur. Tu ne donnes JAMAIS
ton avis sur ce qui est juste ou faux.

CONTEXTE
${contexte}

OBJECTIF
Tu dois COMPRENDRE son raisonnement, pas le corriger. Tes questions doivent :
- Être ouvertes ("comment tu raisonnes ?", "pourquoi 130 et pas 110 ?")
- Révéler les patterns implicites ("est-ce que tu utilises ce calcul tout
  le temps ou seulement dans certains cas ?")
- Pointer les contradictions de manière neutre, pas comme reproche
  ("hier sur le scénario X tu avais bid 110, ici 130 — qu'est-ce qui
  était différent ?")

LIMITES STRICTES
- Tu ne mentionnes JAMAIS d'autres joueurs (Sacha, Rod, Jeje, Gilou).
  Tu ne sais pas qu'ils existent.
- Tu peux citer la Feuille V2.1 pour préciser tes questions.
- Tu peux référencer les annotations passées de ${userName} (mais pas
  des autres).
- Tu réponds en FRANÇAIS, naturellement, sans formalisme excessif.
- Tu es CONCIS — 2-4 phrases par tour, pas plus. La conversation est
  inline dans une UI mobile, pas un blog.

${formatCardSelectionSection(cardSelection)}LA FEUILLE V2.1 (référence)
${feuilleContent}

ANNOTATIONS PASSÉES DE ${userName} (référence)
${userPastAnnotations}

${formatFirstMessageInstructions(cardSelection)}`;
}

// V2.2 Phase 2C — when the user selected cards on the completion screen
// before opening the conversation, surface the selection (raw cards +
// recognized patterns) so Claude's first question can lean on what the
// user said motivated their bid. Returns '' when there's no selection,
// keeping the system prompt unchanged for the no-selection path.
function formatCardSelectionSection(cardSelection) {
  if (!cardSelection || !cardSelection.features) return '';
  if (cardSelection.features.selectedCount === 0)  return '';
  return `SÉLECTION DE CARTES PAR L'UTILISATEUR
L'utilisateur a sélectionné les cartes suivantes pour expliquer son raisonnement :
${describeSelectedCards(cardSelection.features)}

Patterns reconnus dans cette sélection :
${describePatterns(cardSelection.features)}

`;
}

function formatFirstMessageInstructions(cardSelection) {
  const hasSelection = !!(cardSelection && cardSelection.features
    && cardSelection.features.selectedCount > 0);
  if (hasSelection) {
    return `TON PREMIER MESSAGE
Ton premier message doit S'APPUYER sur la sélection de cartes ci-dessus.
Reformule le pattern reconnu et demande à l'utilisateur de confirmer ou
préciser. Exemple : "Tu as sélectionné un maître à l'atout pique + 1 As
extérieur — j'imagine que tu calcules X, c'est bien ça ?" Réfère-toi à
son annonce pour cadrer.`;
  }
  return `TON PREMIER MESSAGE
Tu commences par une question ouverte pour comprendre le raisonnement
de l'utilisateur. Réfère-toi explicitement à son annonce et à ce que
la Feuille suggère pour cadrer.`;
}

function suitLabel(suit) {
  return SUIT_SYMBOL[suit] || suit || '';
}

function formatAction(action) {
  if (!action) return '(aucune action)';
  switch (action.type) {
    case 'bid':       return `${action.value} ${suitLabel(action.suit)}`.trim();
    case 'pass':      return 'pass';
    case 'coinche':   return 'coinche';
    case 'surcoinche': return 'surcoinche';
    case 'play-card': return action.card ? `${action.card.value}${suitLabel(action.card.suit)}` : 'play-card';
    default:          return action.type || '(action inconnue)';
  }
}

function seatRoleLabel(seat, userSeat) {
  if (seat === userSeat) return 'toi';
  if (seat === (userSeat + 2) % 4) return 'partenaire';
  return 'adversaire';
}

function formatHand(cards) {
  // cards: [{suit, value}, ...]
  const bySuit = { S: [], H: [], D: [], C: [] };
  for (const c of cards) if (bySuit[c.suit]) bySuit[c.suit].push(c.value);
  const lines = [];
  for (const s of ['S', 'H', 'D', 'C']) {
    if (bySuit[s].length === 0) continue;
    lines.push(`- ${suitLabel(s)}: ${bySuit[s].join(', ')}`);
  }
  return lines.join('\n');
}

function formatTimelineEvent(ev, userSeat) {
  const role = seatRoleLabel(ev.seat, userSeat);
  switch (ev.event) {
    case 'bid':
      return `- Position ${ev.seat} (${role}) : ${ev.value} ${suitLabel(ev.suit)}`;
    case 'pass':
      return `- Position ${ev.seat} (${role}) : pass`;
    case 'coinche':
      return `- Position ${ev.seat} (${role}) : coinche`;
    case 'surcoinche':
      return `- Position ${ev.seat} (${role}) : surcoinche`;
    case 'play-card': {
      const c = ev.card;
      return `- Position ${ev.seat} (${role}) : joue ${c?.value || ''}${suitLabel(c?.suit)}`;
    }
    default:
      return `- Position ${ev.seat} (${role}) : ${ev.event}`;
  }
}

function formatExpectedAnswer(scenario) {
  const ea = scenario.expectedAnswer;
  if (ea === null || ea === undefined) {
    return '- (la Feuille V2.1 ne couvre pas explicitement ce cas)';
  }
  const label = formatAction(ea.action);
  const ref = ea.ruleReference ? ` (règle ${ea.ruleReference})` : '';
  return `- ${label} (la règle V2.1 suggère ${label})${ref}`;
}

function formatScenarioForClaude(scenario, annotation, cardSelection = null) {
  const userSeat = scenario.userSeat;
  const userHand = scenario.hands?.[String(userSeat)] || [];

  const decision = annotation.decisions?.[0] || {};
  const userAction = decision.action;
  const userNote = decision.note || '';

  // Bidding-history lines: every timeline event up to (and including) the
  // user-turn marker. The user-turn line becomes "Position X (toi) : ?"
  const lines = [];
  for (const ev of scenario.timeline || []) {
    if (ev.event === 'user-turn') {
      lines.push(`- Position ${userSeat} (toi) : ?`);
      break;
    }
    lines.push(formatTimelineEvent(ev, userSeat));
  }

  // V2.2 Phase 2C — append the card selection (raw + patterns) to the
  // first user message so Claude has it in the conversation history, not
  // just the system prompt. Skipped when no selection was made.
  let selectionBlock = '';
  if (cardSelection && cardSelection.features
      && cardSelection.features.selectedCount > 0) {
    selectionBlock = `

CARTES QUE L'UTILISATEUR A SÉLECTIONNÉES POUR JUSTIFIER SON CHOIX :
${describeSelectedCards(cardSelection.features)}

Patterns reconnus :
${describePatterns(cardSelection.features)}`;
  }

  return `Voici le contexte de l'annotation :

MAIN DE L'UTILISATEUR (${userHand.length} cartes) :
${formatHand(userHand)}

DEROULEMENT DES ENCHERES :
${lines.join('\n')}

ANNONCE DE LA FEUILLE V2.1 :
${formatExpectedAnswer(scenario)}

ANNONCE DE L'UTILISATEUR :
- ${formatAction(userAction)} ("Pas d'accord")

NOTE DE L'UTILISATEUR :
- "${userNote}"${selectionBlock}

Ton rôle : engager une conversation avec l'utilisateur pour comprendre
son raisonnement. Pose une première question ouverte.`;
}

function formatPastAnnotations(pastAnnotations) {
  if (!pastAnnotations || pastAnnotations.length === 0) {
    return '(Aucune annotation passée disponible)';
  }
  const lines = [];
  for (const a of pastAnnotations) {
    const d = a.decisions?.[0];
    if (!d) continue;
    const action = formatAction(d.action);
    const rawNote = (d.note || '').replace(/\s+/g, ' ').trim();
    const note = rawNote.length > 100 ? rawNote.slice(0, 100) + '…' : rawNote;
    const div = d.divergenceAgreement ? ` [${d.divergenceAgreement}]` : '';
    lines.push(`- ${a.scenarioId}: ${action}${div}${note ? ` — "${note}"` : ''}`);
  }
  if (lines.length === 0) return '(Aucune annotation passée disponible)';
  return lines.join('\n');
}

async function startConversation({ scenario, annotation, userName, pastAnnotations, feuilleContent, caseType, cardSelection }) {
  const systemPrompt = buildSystemPrompt({
    feuilleContent,
    userName,
    userPastAnnotations: formatPastAnnotations(pastAnnotations),
    caseType,
    cardSelection,
  });

  const userMessage = formatScenarioForClaude(scenario, annotation, cardSelection);

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return {
    text: response.content[0].text,
    usage: response.usage,
    firstUserMessage: userMessage,
  };
}

async function continueConversation({ conversationHistory, userMessage, context }) {
  const systemPrompt = buildSystemPrompt({
    feuilleContent: context.feuilleContent,
    userName: context.userName,
    userPastAnnotations: formatPastAnnotations(context.pastAnnotations),
    caseType: context.caseType,
    cardSelection: context.cardSelection,
  });

  const messages = [
    ...conversationHistory.map(m => ({
      role: m.role === 'claude' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  });

  return {
    text: response.content[0].text,
    usage: response.usage,
  };
}

module.exports = {
  startConversation,
  continueConversation,
  // Exported for the smoke-test script and unit tests:
  formatScenarioForClaude,
  formatPastAnnotations,
  buildSystemPrompt,
  MODEL,
  MAX_TOKENS,
};
