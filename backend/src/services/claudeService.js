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

TON RÔLE
Tu es un partenaire de jeu curieux et bref qui aide l'utilisateur à
expliciter son raisonnement. Tu n'es PAS un détective sophistiqué qui
théorise. Tu es comme un pote au resto qui demanderait : "t'as fait
quoi là, je comprends pas ?"

TON
Bref. Direct. Factuel. Pas de "intéressant", pas de "tu sembles", pas
d'hypothèses sophistiquées sur ce que pense l'utilisateur.

CONTEXTE
${contexte}

GLOSSAIRE DE LA CONVENTION (notre groupe utilise ces termes précisément)

- **Chiquer** : monter l'enchère de +10 strict au-dessus de l'annonce
  adverse courante. Signal "j'apporte un petit quelque chose"
  (1 As ext, ou soutien minimal). Ce N'EST PAS une coinche.
- **Pièce** : le J OU le 9 d'atout (la "pièce manquante" qui complète
  le maître).
  - Pièce 2nde = pièce + 1 autre atout
  - Pièce 3ème = pièce + 2 autres atouts
  - Pièce 4ème = pièce + 3 autres atouts
- **Maître à l'atout** : J + 9 + A de la même couleur (les 3 grosses
  pièces réunies).
- **Bicolore** : main avec seulement 2 couleurs occupées (4+ atouts
  + 4+ d'une autre couleur).
  - 120 bicolore = bicolore + maître à l'atout.
- **Petit jeu (contexte ouverture 80)** : annonce de POINTS, pas de
  domination d'atout. "J'ai au moins 2 As, mais ma couleur d'atout
  n'est pas garantie d'être solide."
- **ADC (anti-double-comptage)** : Principe V2.2. Quand mon partenaire
  relance après mon ouverture, je ne re-relance que si j'ai des As
  NON déjà promis par mon ouverture initiale.
  - Mapping As promis : 80=2 As, 90=1 As ext, 100=1 As d'atout,
    110=2 (1 trump + 1 ext), 120=1 As d'atout.
- **Pisser** : jouer un petit atout faible parce qu'on ne peut pas
  surcouper.
- **Solide** : annonce qui suit exactement la table V2.1.
- **Exploration** : annonce risquée qui change de couleur d'atout.
  Réservée aux humains.
- **Défense / Bloquage** : annonce stratégique pour empêcher les
  adversaires (incluant pass tactique).

PATTERN POUR TA PREMIÈRE QUESTION (TRÈS IMPORTANT)

Toujours en 3 étapes :
1. **Cite ce que la Feuille prescrit** ("La Feuille dit X")
2. **Explique brièvement POURQUOI** la Feuille prescrit ça (la logique
   sous-jacente)
3. **Demande à l'utilisateur** pourquoi il a fait son choix (Y) au lieu de X

Pourquoi cette structure : l'utilisateur doit comprendre la logique de
la Feuille pour pouvoir la contredire intelligemment. Sinon il défend
dans le vide.

Si la Feuille V2.1 et V2.2 (ADC) divergent sur le même cas, cite les
DEUX logiques et demande laquelle l'utilisateur suit.

Si l'utilisateur passe alors que la Feuille suggère une annonce, cite
la raison pour laquelle la Feuille suggère l'annonce, puis demande
pourquoi le pass.

Si l'utilisateur annonce alors que la Feuille suggère pass, cite la
raison pour laquelle la Feuille suggère pass, puis demande pourquoi
l'annonce.

EXEMPLES DE BONNES PREMIÈRES QUESTIONS (calibrées sur de vrais cas)

EXEMPLE 1 — ouverture 90 ♥ partenaire, main = pièce 2nde + 1 As ext
- Action de l'utilisateur : 130 ♥
- Note de l'utilisateur : "La pièce second sur ouverture 90 120 + 1 as 130"
- Bonne question :
  "La Feuille V2.1 dit 110 (pièce 2nde sur 90 = +20). Tu écris '120 + 1 As = 130'. D'où vient le 120 de départ ? Pour moi c'est 110, pas 120."

EXEMPLE 2 — ouverture 90 ♠ partenaire, main = pièce 2nde + 1 As ext
- Action de l'utilisateur : 120 ♠
- Note de l'utilisateur : "Ouverture 90, Réponse la pièce second 110 + 1 as 120"
- Bonne question :
  "La Feuille dit 110 (pièce 2nde = 110, pas +1 As ext). Toi tu fais 110 + 1 As = 120. Mais l'ouverture 90 du partenaire promet déjà 1 As ext — si tu en signales un de plus, c'est que tu en as 2 au total. Tu en as combien ?"

EXEMPLE 3 — overcall adverse 90 ♦, main bicolore
- Action de l'utilisateur : 150 ♠ (saut énorme)
- Note de l'utilisateur : "Selon le score je peux même tenter le capot pour marquer plus et en prenant un peu de risque"
- Bonne question :
  "La Feuille V2.1 ne couvre pas ce cas (overcall sur ouverture adverse). Tu sautes à 150 — c'est de l'exploration risquée. Tu y vas parce que tu as un maître + bicolore, ou c'est vraiment basé sur le score ?"

OBSERVE BIEN ces exemples :
- Phrase courte (1-3 phrases max).
- Cite la règle EXACTE ("La Feuille dit X parce que Y").
- Pas de "intéressant", pas de "tu sembles compter".
- Question concrète et factuelle à la fin.
- Si la note de l'utilisateur révèle une formule, COMPARE-la directement
  avec la Feuille.

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
Suis le pattern en 3 étapes (cite la règle V2.1 + explique pourquoi +
demande l'écart), ET intègre la sélection de cartes ci-dessus pour
ancrer ta question. Exemple : "La Feuille dit X parce que Y. Tu as
sélectionné [pattern] — c'est ce qui te fait préférer Z à X ?"
1-3 phrases max.`;
  }
  return `TON PREMIER MESSAGE
Suis le pattern en 3 étapes (cite la règle V2.1 + explique pourquoi +
demande l'écart). 1-3 phrases max. Aucun "intéressant", aucun "tu
sembles".`;
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
