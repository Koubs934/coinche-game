// ── Training tag labels (shared fragments) ───────────────────────────────────
// Tags in Groups 1, 2, 3, 5, 6, 7, 8 appear under every v2 bidding action
// (bid/pass/coinche/surcoinche). Defined once here, spread into each action.
// Group 4 (bidding-action) is action-specific and spelled out inline below.
const _sharedBidDecisionTagsFr = {
  // Groupe 1 — Main d'atout
  'maitre':             "Maître à l'atout",
  'valet-second':       'Valet second',
  'valet-troisième':    'Valet troisième',
  'valet-quatrième':    'Valet quatrième',
  'valet-cinquième':    'Valet cinquième',
  '9-second':           '9 second',
  '9-troisième':        '9 troisième',
  '9-quatrième':        '9 quatrième',
  '9-cinquième':        '9 cinquième',
  'atout-count-2':      '2 atouts',
  'atout-count-3':      '3 atouts',
  'atout-count-4':      '4 atouts',
  'atout-count-5-plus': '5+ atouts',
  'belote-possible':    'Belote',

  // Groupe 2 — Main hors atout
  'as-extérieur-0': '0 As extérieur',
  'as-extérieur-1': '1 As extérieur',
  'as-extérieur-2': '2 As extérieur',
  'as-extérieur-3': '3 As extérieur',
  'deux-as-bare':   '2 As (signal informatif)',
  '21':             '21 (As + 10 même couleur)',
  'deux-21':        'Deux 21',
  'longue':         'Longue',

  // Groupe 3 — Forme de la main
  'bicolore':       'Bicolore',
  'fausse-carte-1': '1 fausse carte',
  'fausse-carte-2': '2 fausses cartes',

  // Groupe 5 — Contexte partenaire
  'premier-à-parler':              'Premier à parler',
  'partenaire-ouverture-80':       'Partenaire a ouvert 80',
  'partenaire-ouverture-90':       'Partenaire a ouvert 90',
  'partenaire-ouverture-100':      'Partenaire a ouvert 100',
  'partenaire-ouverture-110-plus': 'Partenaire a ouvert 110+',
  'partenaire-même-couleur':       'Partenaire dans ma couleur',
  'partenaire-autre-couleur':      'Partenaire autre couleur',

  // Groupe 6 — Contexte adverse
  'adverse-a-ouvert':     'Adverse a ouvert',
  'adverse-a-surenchéri': 'Adverse a surenchéri',

  // Groupe 7 — Contexte score
  'score-équilibré': 'Score équilibré',
  'score-derrière':  'Derrière, besoin de points',
  'score-avance':    'En avance, sécurisation',
  'dernière-donne':  'Dernière donne du match',

  // Groupe 8 — Incertitude
  'jugement':  'Jugement',
  'incertain': 'Incertain',
  'autre':     'Autre (note requise)',
};

export default {
  // Auth
  signIn: 'Se connecter',
  signUp: "S'inscrire",
  email: 'E-mail',
  username: "Nom d'utilisateur",
  password: 'Mot de passe',
  haveAccount: 'Déjà un compte ?',
  noAccount: 'Pas encore de compte ?',
  signOut: 'Se déconnecter',

  // Lobby
  createRoom: 'Créer une salle',
  joinRoom: 'Rejoindre une salle',
  roomCode: 'Code de salle',
  join: 'Rejoindre',
  waitingForPlayers: 'En attente des joueurs...',
  playersJoined: (n) => `${n}/4 joueurs`,
  shareCode: 'Partagez ce code avec vos amis :',
  startGame: 'Démarrer la partie',
  targetScore: 'Score cible',
  team1: 'Équipe 1',
  team2: 'Équipe 2',
  assignTeams: 'Assigner les équipes',
  moveToTeam1: "Mettre en Équipe 1",
  moveToTeam2: "Mettre en Équipe 2",
  needFourPlayers: 'Il faut 4 joueurs pour commencer',
  needEqualTeams: 'Chaque équipe doit avoir 2 joueurs',
  youAreCreator: 'Vous êtes le créateur de la salle',
  fillWithBots: 'Remplir avec des robots',
  bot: 'Robot',

  // Game
  bid: 'Annoncer',
  pass: 'Passer',
  coinche: 'Coinche !',
  surcoinche: 'Surcoinche !',
  trump: 'Atout',
  contract: 'Contrat',
  yourTurn: 'À vous de jouer',
  waitingFor: (name) => `En attente de ${name}...`,
  biddingPhase: 'Annonces',
  playingPhase: 'Jeu',
  capot: 'Capot',
  belote: 'Belote',
  rebelote: 'Rebelote',
  announceBelote: 'Déclarer Belote ?',
  no: 'Non',

  // Scores
  score: 'Score',
  trickPoints: 'Points faits',
  announcedPoints: 'Points annoncés',
  roundScore: 'Score de la manche',
  totalScore: 'Total',
  team: 'Équipe',
  contractMade: 'Contrat réussi !',
  contractFailed: 'Contrat chuté',
  roundOver: 'Fin du tour',
  nextRound: 'Tour suivant',
  readyCount: (n, total) => `${n} / ${total} prêt(s) — en attente…`,
  seeAllTricks: 'Voir tous les plis',
  allTricks: 'Tous les plis',
  trick: 'Pli',
  gameOver: 'Fin de partie !',
  winner: 'Vainqueur',
  wins: 'gagne !',
  playAgain: 'Nouvelle partie',

  // Leave / remove
  leaveTable: 'Quitter la table',
  leaveConfirmLobby: 'Quitter cette salle ?',
  leaveConfirmGame: 'Quitter la table ? La partie sera mise en pause jusqu\'à ce qu\'un joueur prenne votre place.',
  removePlayer: 'Retirer',
  removeConfirm: (name) => `Retirer ${name} ? La partie sera en pause jusqu'à ce qu'un joueur prenne sa place.`,
  removeConfirmLobby: (name) => `Retirer ${name} de la salle ?`,

  // Admin panel
  managePlayers: 'Gérer',
  managePlayersTitle: 'Gérer les joueurs',
  adminBadge: 'Admin',
  seat: 'Siège',

  // Pending join
  waitingApproval: 'En attente d\'approbation',
  waitingApprovalMsg: 'Votre demande a été envoyée. En attente de l\'acceptation de l\'administrateur.',
  cancelRequest: 'Annuler la demande',
  pendingJoinsLabel: 'Demande de rejoindre :',
  acceptJoin: 'Accepter',
  pendingJoinsWaiting: 'Un joueur souhaite rejoindre — approbation de l\'admin requise',

  // Disconnect
  playerDisconnected: (name) => `${name} s'est déconnecté. En attente de reconnexion...`,
  gamePaused: 'Partie en pause — une place est libre',
  reconnecting: 'Reconnexion...',
  reconnected: 'Reconnecté',
  reconnectedYourTurn: 'Reconnecté — à vous de jouer',

  // Suits
  suitName: { S: 'Pique', H: 'Cœur', D: 'Carreau', C: 'Trèfle' },
  suitSymbol: { S: '♠', H: '♥', D: '♦', C: '♣' },

  // Positions
  you: 'Vous',
  partner: 'Partenaire',
  left: 'Gauche',
  right: 'Droite',

  // Misc
  coincheBonus: 'Coinche',
  surcoinchBonus: 'Surcoinche',
  chutePenalty: 'Base de chute',
  replayBtn: 'Rejouer',
  replayPrev: 'Précédent',
  replayNext: 'Suivant',
  replayEnd: 'Retour au résumé',
  trickLead: 'Entame',
  firstToSpeak: '1er à parler',
  coinched: 'Coinché',
  surcoinched: 'Surcoinché',
  dixDeDer: '+10 (dix de der)',
  sortHand: 'Trier',
  sortManual: 'Manuel',
  lastTrick: 'Dernier pli',
  wonTrick: 'a remporté le pli',
  liveRound: 'Pli en cours',

  // Mélange / Coupe
  shuffle: 'Mélanger',
  noShuffle: 'Ne pas mélanger',
  cut: 'Couper',
  noCut: 'Ne pas couper',
  yourTurnShuffle: 'À vous de mélanger',
  yourTurnCut: 'À vous de couper',
  waitingShuffle: (name) => `${name} choisit de mélanger...`,
  waitingCut: (name) => `${name} choisit de couper...`,
  pickCutValue: 'Choisissez la coupe',
  deckShuffled:    (name) => `${name} a mélangé`,
  deckNotShuffled: (name) => `${name} n'a pas mélangé`,
  deckCut:         (name) => `${name} a coupé`,
  deckNotCut:      (name) => `${name} n'a pas coupé`,

  // Annuler
  undoAction: 'Annuler',

  // Validation
  invalidRoomCode: 'Le code doit comporter 6 lettres ou chiffres',
  usernameTooShort: 'Le nom doit comporter au moins 2 caractères',

  // Mode entraînement — labels pour la capture de raisonnement.
  // Le français est la langue canonique; l'anglais est une traduction.
  // Les clés sont immuables (définies dans backend/src/training/reasonTags.json)
  // et ne doivent pas être renommées sans gérer la migration des données existantes.
  // Intitulé du bouton sur l'écran Lobby
  lobbyTrainingBtn: 'Entraînement',
  // Indication sous le bouton Entraînement quand un partiel est en attente
  lobbyResumableHint: (n) => n === 1 ? '1 scénario à terminer' : `${n} scénarios à terminer`,

  training: {
    // Confirm + button label when the user leaves a training run
    abandonConfirm: "Abandonner ce scénario ? Votre annotation sera jetée.",
    abandonLabel:   "Abandonner",

    picker: {
      title:             'Scénarios d\'entraînement',
      subtitle:          'Jouez des scénarios et enregistrez votre raisonnement.',
      empty:             'Aucun scénario disponible.',
      resumableHeading:  'Reprendre une annotation en cours',
      resumableAgeMin:   (n) => `commencé il y a ${n} min`,
      actionShown:       'Dernière action :',
      resumeBtn:         'Reprendre',
      discardBtn:        'Jeter',
      startBtn:          'Démarrer',
      back:              'Retour',
      // Exhaustion rendering
      scenariosToAnnotate:  (n) => n === 1 ? '1 scénario à annoter' : `${n} scénarios à annoter`,
      showCompleted:        (n) => `Afficher les scénarios terminés (${n})`,
      hideCompleted:        'Masquer les scénarios terminés',
      completedSection:     'Scénarios terminés',
      completedBadge:       'Terminé',
      alternativesRecorded: (n) => n === 1 ? '1 stratégie enregistrée' : `${n} stratégies enregistrées`,
    },
    completion: {
      title:        'Scénario terminé',
      actionLabel:  'Votre action',
      tagsLabel:    'Tags retenus',
      noteLabel:    'Votre note',
      noTags:       '(aucun tag sélectionné)',
      noNote:       '(aucune note)',
      backToPicker: 'Retour aux scénarios',
      nextScenario: 'Scénario suivant',
    },

    errors: {
      sessionInterrupted: 'Session interrompue — consultez les scénarios à reprendre.',
      // Code-keyed error messages — App.jsx looks these up by the server's
      // error.code before falling back to the raw server message.
      byCode: {
        DUPLICATE_BID_IN_SESSION: "Cette enchère a déjà été enregistrée dans cette session. Choisissez une enchère différente.",
        UNKNOWN_SESSION:          'Session inconnue ou expirée.',
      },
    },

    panel: {
      title:                     'Pourquoi ce choix ?',
      actionLabel:               'Action jouée',
      notePlaceholderOptional:   'Facultatif — qu’est-ce qui vous a fait pencher vers ce choix ?',
      notePlaceholderRequired:   'Obligatoire — quel raisonnement n’est pas capté par les tags ?',
      noteLabel:                 'Note',
      submit:                    'Valider',
      // Client-side validation helpers (mirror tagValidator.js)
      helperEmpty:               'Choisir au moins un tag ou écrire une note',
      helperNoteRequired:        'La note est requise pour le tag sélectionné',
      helperMissingRequired:     (groupLabel) => `Sélectionnez un tag dans « ${groupLabel} »`,
      helperMultipleRequired:    (groupLabel) => `Un seul tag autorisé dans « ${groupLabel} »`,
      requiredBadge:             'Requis',
      // Soft-warning confirmation overlay (server-returned, non-blocking)
      warningHeading:            'Vérifier votre choix',
      warningContinueBtn:        'Continuer',
      warningBackBtn:            'Revenir et ajouter',
      // Post-completion exhaustion review overlay
      reviewPromptTitle:         'Autre stratégie possible ?',
      reviewPromptBody:          'Si vous pouvez imaginer une autre lecture de cette main menant à une enchère différente, explorez-la.',
      reviewContinueBtn:         'Oui, autre stratégie',
      reviewEndBtn:              'Non, c\'est tout',
      changeAction:              'Changer mon action',
      // Action-display prefixes
      youBid:                    'Vous avez annoncé',
      youPassed:                 'Vous avez passé',
      youCoinched:               'Vous avez coinché',
      youSurcoinched:            'Vous avez surcoinché',
      youPlayed:                 'Vous avez joué',
      // Mock-only — not shown outside the mock harness
      mockHarnessHeading:        'Mode démo — panneau de raisonnement',
      mockSwitcherLabel:         'Type d’action',
    },
    actions: {
      bid:         'Annonce',
      pass:        'Passer',
      coinche:     'Coinche',
      surcoinche:  'Surcoinche',
      'play-card': 'Jeu de carte',
    },
    tags: {
      groups: {
        // v2 groups (bid/pass/coinche/surcoinche)
        'trump-hand':       "Main d'atout",
        'non-trump-hand':   'Main hors atout',
        'hand-shape':       'Forme de la main',
        'bidding-action':   'Annonce',
        'partner-context':  'Contexte partenaire',
        'opponent-context': 'Contexte adverse',
        'score-context':    'Contexte score',
        'meta':             'Incertitude',
        // Legacy groups — still used by the (v1-carried-over) play-card action
        'hand-claim':     'Force de la main',
        'tactical':       'Tactique',
        'partner-signal': 'Signal au partenaire',
        'defensive':      'Défensif',
        'situational':    'Contextuel',
        'uncertainty':    'Incertitude',
        'other':          'Autre',
      },
      bid: {
        ..._sharedBidDecisionTagsFr,
        // Groupe 4 — Annonce (bid-specific)
        'ouverture':                   'Ouverture',
        'monter':                      'Monter (même couleur)',
        'changer':                     'Changer de couleur',
        'bloquage':                    'Annonce de blocage',
        'faire-monter-pour-coincher':  'Faire monter pour coincher',
        'cherche-mon-partenaire':      'Cherche mon partenaire',
        'surenchère-compétitive':      'Surenchère compétitive',
      },
      pass: {
        ..._sharedBidDecisionTagsFr,
        // Groupe 4 — Annonce (pass-specific)
        'passer-faible':      'Passer (main faible)',
        'passer-stratégique': 'Passer (stratégique)',
      },
      coinche: {
        ..._sharedBidDecisionTagsFr,
        'coincher': 'Coincher',
      },
      surcoinche: {
        ..._sharedBidDecisionTagsFr,
        'surcoincher': 'Surcoincher',
      },
      'play-card': {
        'cashing-winner-before-cut':  'Encaisser avant la coupe',
        'drawing-trump':              'Tirer les atouts',
        'promoting-partners-card':    'Promouvoir la carte du partenaire',
        'letting-partner-win':        'Laisser gagner le partenaire',
        'signalling-suit-to-partner': 'Signaler une couleur au partenaire',
        'belote-order-signal':        "Signal d'ordre Belote (K/Q)",
        'appel-direct':               'Appel direct',
        'appel-indirect':             'Appel indirect',
        'protecting-high-card':       'Protéger une carte maîtresse',
        'saving-trump-for-later':     "Garder l'atout pour plus tard",
        'dumping-garbage':            'Défausse sans valeur',
        'forced-only-legal-card':     'Carte imposée',
        'non-default-winner-choice':  'Choix délibéré du gagnant',
        'shedding-to-create-ruff':    'Se défausser pour couper',
        'forcing-opponent-to-trump':  "Forcer l'adversaire à couper",
        'endgame-positioning':        'Fin de partie (plis 6-7)',
        'last-trick-dix-de-der':      'Dix de der',
        'judgment-call':              'Jugement',
        'not-sure':                   'Incertain',
        'other':                      'Autre',
      },
    },
  },
};
