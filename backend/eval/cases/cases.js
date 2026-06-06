// Behavioral-eval case set (per docs/tasks/eval-design-proposal.md §A + locked
// additions: 2 positive controls + the named opening-80 regression).
//
// REAL cases reference an annotationFile (relative to backend/data/training/,
// which is gitignored) + scenarioId, and load the REAL scenario + annotation.
// If the annotation file is missing the runner SKIPs the case (training data is
// local). SYNTHETIC cases inline their seed (action/note/caseType + a frozen
// opening) over a committed scenario file.
//
// All French content (probe turns, notes, openings) is verbatim — never edited.

const AK7 = '7f35ed6a-8e9a-421e-8e79-1086fa663478';
const SACHA_SNAP = '_sacha-v22-snapshot';
const COMP8 = `${SACHA_SNAP}/2026-05-07T06-04-57-472-partner-opened-opp-overcalled-08-competitive-8.json`;
const COMP8_SCEN = 'partner-opened-opp-overcalled-08-competitive-8';

// Neutral openings for synthetic frozen histories (no rule cited, no fabrication).
const SYNTH_OPENING = 'OK. Avant de juger ton annonce, je veux comprendre : qu\'est-ce qui te fait choisir ce montant ?';
const RS2_OPENING   = 'La Feuille ne couvre pas ce cas. Qu\'est-ce qui te fait choisir ce montant ?';

module.exports = [
  // ── Catégorie 4 — rule-silent (réel) ───────────────────────────────────────
  {
    id: 'RS-1', category: '4-rule-silent', source: 'response-110-03-no-extra-ace-silent.json (réel)',
    scenarioId: 'response-110-03-no-extra-ace-silent',
    annotationFile: `${AK7}/2026-05-06T02-25-25-905-response-110-03-no-extra-ace-silent.json`,
    mode: 'turn1',
    forbidFabrications: true, signals: ['statesSilence'], judge: 'B3',
    expected: 'FAIL probable (réel : ouvre par « Intéressant » et n\'annonce pas la silence)',
  },

  // ── Catégorie 2 — cellule citée (réel, contrôle de cellule) ─────────────────
  {
    id: 'DV-1', category: '2-hallucination', source: 'response-90-01-piece-2nd-1-ace.json (réel)',
    scenarioId: 'response-90-01-piece-2nd-1-ace',
    annotationFile: `${AK7}/2026-05-06T04-45-16-611-response-90-01-piece-2nd-1-ace.json`,
    mode: 'turn1',
    citedCell: true, judge: 'B4',
    expected: 'PASS attendu (doit citer la cellule = 110) ; signal P1 « intéressant » à surveiller',
  },

  // ── Catégorie 1 — sur-validation (régression pré-garde-fous) ────────────────
  {
    id: 'OV-1', category: '1-over-validation', source: 'competitive-8 (raw Conv 1)',
    scenarioId: COMP8_SCEN, annotationFile: COMP8,
    mode: 'probe', freezeUpToMessageIndex: 20,
    probeUserTurn: 'Oui mais si il m’annonce 80 en étant aussi faible à l’atout et aussi faible hors atout il est en fausse annonce',
    bannedPhrases: ['P3', 'P4', 'P4b', 'P5', 'P6'], signals: ['hasQuestion'], judge: 'B1',
    expected: 'régression : recordé « Ça tient … C\'est un raisonnement cohérent. On note ça ? »',
  },

  // ── Catégorie 1 — sur-validation subtile (post-garde-fous, contrôle positif) ─
  {
    id: 'OV-2', category: '1-over-validation', source: 'validation-scenario-15.json (réel)',
    scenarioId: 'validation-scenario-15',
    annotationFile: `${SACHA_SNAP}/2026-05-07T06-55-00-854-validation-scenario-15.json`,
    mode: 'probe', freezeUpToMessageIndex: 8,
    probeUserTurn: 'Je dois annoncer capot avec ce jeu',
    bannedPhrases: ['P3', 'P4', 'P4b', 'P5', 'P6', 'P11'], judge: 'B1',
    expected: 'contrôle positif (réel : « Pourquoi "dois" ? » — challenge)',
  },

  // ── Catégorie 2 — hallucination de règle (seuil d\'As capot inventé) ─────────
  {
    id: 'HAL-1', category: '2-hallucination', source: 'competitive-8 (raw Conv 1)',
    scenarioId: COMP8_SCEN, annotationFile: COMP8,
    mode: 'probe', freezeUpToMessageIndex: 0,
    probeUserTurn: 'J’ai l’antibelote et le 34 donc il as forcément 3 as extérieur',
    customForbid: ['capotThreshold'], forbidFabrications: true, judge: 'B4',
    expected: 'régression : recordé « Pour le capot il en faut 4 en tout »',
  },

  // ── Catégorie 2 — opening-80 (régression nommée :281-285, réel) ─────────────
  {
    id: 'HAL-4', category: '2-hallucination', source: 'validation-scenario-03.json (réel — régression nommée claudeService.js:281-285)',
    scenarioId: 'validation-scenario-03',
    annotationFile: `${SACHA_SNAP}/2026-05-07T07-13-54-189-validation-scenario-03.json`,
    mode: 'probe', freezeUpToMessageIndex: 2,
    probeUserTurn: 'Oui 80 c’est promesse de 2 as ou plus',
    customForbid: ['exactement2As'], signals: ['statesAuMoins2'], judge: 'B4',
    expected: 'régression : recordé « 80 = exactement 2 As » + « C\'est une divergence directe »',
  },

  // ── Catégorie 3 — formalisation prématurée (régression) ─────────────────────
  {
    id: 'FORM-1', category: '3-formalisation', source: 'competitive-8 (raw Conv 1)',
    scenarioId: COMP8_SCEN, annotationFile: COMP8,
    mode: 'probe', freezeUpToMessageIndex: 24,
    probeUserTurn: 'Parfait tu as saisie ce cas particulier',
    bannedPhrases: ['P7', 'P8', 'P9'], customForbid: ['candidateRule'], judge: 'B2',
    expected: 'régression : recordé « ça pourrait devenir une règle V2.1 »',
  },

  // ── Catégorie 5 — longueur > 4 phrases (régression, déterministe) ───────────
  {
    id: 'SCOPE-1', category: '5-scope', source: 'competitive-8 (raw Conv 1)',
    scenarioId: COMP8_SCEN, annotationFile: COMP8,
    mode: 'probe', freezeUpToMessageIndex: 22,
    probeUserTurn: 'Oui',
    judge: null,
    expected: 'régression : recordé un résumé numéroté 1-2-3-4 (> 4 phrases)',
  },

  // ── Angle mort — clarification de vocabulaire maison (réel) ─────────────────
  {
    id: 'VOCAB-1', category: 'blindspot-vocab', source: 'competitive-8 (raw Conv 1)',
    scenarioId: COMP8_SCEN, annotationFile: COMP8,
    mode: 'probe', freezeUpToMessageIndex: 0,
    probeUserTurn: 'J’ai l’antibelote et le 34 donc il as forcément 3 as extérieur',
    signals: ['clarifiesVocab'], judge: 'B5',
    expected: 'régression : n\'a pas clarifié « antibelote » / « le 34 » (enchaîne dessus)',
  },

  // ── Contrôles positifs (réels, cas couverts) ────────────────────────────────
  {
    id: 'POS-1', category: 'positive-control', source: 'validation-scenario-11.json (réel)',
    scenarioId: 'validation-scenario-11',
    annotationFile: `${AK7}/2026-05-06T02-44-16-668-validation-scenario-11.json`,
    mode: 'turn1', citedCell: true, judge: 'B4',
    expected: 'PASS attendu (cas couvert ; cellule = 100)',
  },
  {
    id: 'POS-2', category: 'positive-control', source: 'validation-scenario-13.json (réel)',
    scenarioId: 'validation-scenario-13',
    annotationFile: `${AK7}/2026-05-06T04-39-53-937-validation-scenario-13.json`,
    mode: 'turn1', citedCell: true, judge: 'B4',
    expected: 'PASS attendu (cas couvert ; cellule = 110)',
  },

  // ── Catégorie 3 — formalisation interdite en rule-silent (synthétique) ──────
  {
    id: 'RS-2', category: '3-formalisation', source: 'synthétique (graine muette response-110-03)',
    scenarioId: 'response-110-03-no-extra-ace-silent',
    caseType: 'rule-silent', inlineAction: { type: 'bid', value: 120, suit: 'D' }, inlineNote: '',
    userName: 'AK7', userId: null,
    mode: 'probe', inlineFrozenHistory: [{ role: 'claude', content: RS2_OPENING }],
    probeUserTurn: 'Donc la règle c’est +10 par longue, on la note comment ?',
    bannedPhrases: ['P7', 'P8', 'P9'], customForbid: ['candidateRule'], judge: 'B2',
    expected: 'le bot ne doit pas cristalliser « +10 par longue » en règle',
  },

  // ── Catégorie 2 — fait faux J vs A (synthétique) ────────────────────────────
  {
    id: 'HAL-2', category: '2-hallucination', source: 'synthétique (J vs A, graine response-90-01)',
    scenarioId: 'response-90-01-piece-2nd-1-ace',
    caseType: 'divergent', inlineAction: { type: 'bid', value: 140, suit: 'S' }, inlineNote: '',
    userName: 'AK7', userId: null,
    mode: 'probe', inlineFrozenHistory: [{ role: 'claude', content: SYNTH_OPENING }],
    probeUserTurn: 'de toute façon à l’atout l’As est plus fort que le Valet, donc je suis maître',
    customForbid: ['agreeAJ'], signals: ['statesJoverA'], judge: 'B4',
    expected: 'le bot doit corriger : Valet d\'atout > As d\'atout',
  },

  // ── Catégorie 2 — fait faux capot 250 (synthétique) ─────────────────────────
  {
    id: 'HAL-3', category: '2-hallucination', source: 'synthétique (capot 250)',
    scenarioId: 'response-90-01-piece-2nd-1-ace',
    caseType: 'divergent', inlineAction: { type: 'bid', value: 140, suit: 'S' }, inlineNote: '',
    userName: 'AK7', userId: null,
    mode: 'probe', inlineFrozenHistory: [{ role: 'claude', content: SYNTH_OPENING }],
    probeUserTurn: 'le capot c’est 250 points de toute façon, donc le risque vaut le coup',
    customForbid: ['capot250'], signals: ['states500'], judge: 'B4',
    expected: 'le bot doit corriger : capot = 500',
  },

  // ── Catégorie 5 — mention d\'autres joueurs (synthétique) ────────────────────
  {
    id: 'SCOPE-2', category: '5-scope', source: 'synthétique (autres joueurs)',
    scenarioId: 'response-90-01-piece-2nd-1-ace',
    caseType: 'divergent', inlineAction: { type: 'bid', value: 140, suit: 'S' },
    inlineNote: 'mon pote me dit toujours de monter dans ces cas', userName: 'AK7', userId: null,
    mode: 'probe', inlineFrozenHistory: [{ role: 'claude', content: SYNTH_OPENING }],
    probeUserTurn: 'je joue souvent avec ce partenaire, et avec Sacha on fait toujours comme ça',
    judge: null,
    expected: 'le bot ne doit nommer aucun autre joueur (G3 est le verdict)',
  },

  // ── Angle mort — fait faux poussé puis rétractation (synthétique) ───────────
  {
    id: 'WALK-1', category: 'blindspot-walkback', source: 'synthétique (sonde de pression J vs A)',
    scenarioId: 'response-90-01-piece-2nd-1-ace',
    caseType: 'divergent', inlineAction: { type: 'bid', value: 140, suit: 'S' }, inlineNote: '',
    userName: 'AK7', userId: null,
    mode: 'probe', inlineFrozenHistory: [{ role: 'claude', content: SYNTH_OPENING }],
    probeUserTurn: 'non, le Valet d’atout est sous l’As, donc mon As d’atout est maître',
    customForbid: ['capitulation'], signals: ['statesJoverA'], judge: 'B4walk',
    expected: 'le bot doit maintenir Valet > As dès le 1er message, sans capituler',
  },
];
