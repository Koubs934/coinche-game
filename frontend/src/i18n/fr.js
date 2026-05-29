// v3 (2026-05-04): the structured tag vocabulary was removed alongside the
// divergence-driven UI rewrite. The shared `_sharedBidDecisionTagsFr`
// fragment that lived here is gone — git history preserves it. Annotation
// is now: pick action → (if rules diverge or are silent) free-text note.

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
  settings: 'Réglages',
  language: 'Langue',
  preferences: 'Préférences',
  modeSacha: 'Mode Sacha',
  sachaOff: 'Couleurs alternées · atout à gauche',
  sachaOn: 'Couleurs alternées · atout libre',
  delfinoOff: 'Cartes en taille normale',
  delfinoOn: 'Cartes agrandies',
  partnerPeek: 'Mode partenaire',

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
  us: 'Nous',
  them: 'Eux',
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
  highestBid: 'Enchère la plus haute',
  bidSheetCta: 'Enchérir',
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
  showDetail: 'Voir le détail ▾',
  hideDetail: 'Masquer le détail ▴',
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
  leaveShort: 'Quitter',   // libellé court pour la barre compacte (le title complet reste « Quitter la table »)
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
  opponent: 'Adversaire',

  // Misc
  coincheBonus: 'Coinche',
  surcoinchBonus: 'Surcoinche',
  chutePenalty: 'Base de chute',
  contractBase: 'Base du contrat',
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

  // Chat de table
  chat: {
    title:       'Chat',
    open:        'Ouvrir le chat',
    placeholder: 'Écrire un message…',
    send:        'Envoyer',
    empty:       'Aucun message — dites bonjour !',
  },

  // Validation
  invalidRoomCode: 'Le code doit comporter 6 lettres ou chiffres',
  usernameTooShort: 'Le nom doit comporter au moins 2 caractères',

  // Revue de partie — étiquetage libre des erreurs de jeu en cours de partie
  button: {
    tagPlayError: 'Erreur de jeu',
  },
  overlay: {
    tagPlayError: {
      heading:         'Marquer une erreur de jeu',
      trickLabel:      (n) => `Pli ${n}`,
      currentTrick:    'Pli en cours',
      // "Pli {{trick}}, joueur '{{username}}' (siège {{seat}}) a joué le {{card}}"
      cardSelected:    ({ trick, username, seat, card }) =>
                        `Pli ${trick}, joueur « ${username} » (siège ${seat}) a joué le ${card}`,
      notePlaceholder: 'Pourquoi cette carte est une erreur ?',
      saveBtn:         'Enregistrer',
      cancelBtn:       'Annuler',
    },
  },
  toast: {
    gameRecordSaved: 'Partie sauvegardée pour analyse',
  },
  errors: {
    // Server error codes emitted by the Game Review backend. App.jsx prefers
    // these over the generic server message when a code is present.
    byCode: {
      FORBIDDEN_NOT_ROOM_CREATOR: 'Seul le créateur de la partie peut marquer des erreurs.',
      INVALID_CARD_REF:           "Cette carte n'a pas été jouée ainsi dans ce pli.",
      NOTE_EMPTY:                 'La note ne peut pas être vide.',
      NOTE_TOO_LONG:              'La note dépasse la longueur maximum.',
      UNKNOWN_GAME:               'Cette partie est introuvable ou déjà terminée.',
    },
  },

  // Mode entraînement — labels pour la capture de raisonnement.
  // Le français est la langue canonique; l'anglais est une traduction.
  // Les clés sont immuables (définies dans backend/src/training/reasonTags.json)
  // et ne doivent pas être renommées sans gérer la migration des données existantes.
  // Intitulé du bouton sur l'écran Lobby
  lobbyTrainingBtn: 'Entraînement',
  // Indication sous le bouton Entraînement quand un partiel est en attente
  lobbyResumableHint: (n) => n === 1 ? '1 scénario à terminer' : `${n} scénarios à terminer`,

  // Écran d'accueil (layout B)
  lobby: {
    readyToPlay:   'Prêt à jouer',
    activeGames:   'Parties en cours',
    noActiveGames: 'Aucune partie en cours',
    refresh:       'Actualiser',
    rejoin:        'Reprendre',
    join:          'Rejoindre',
    roomLine:      (count, mode) => `${count}/4 · ${mode}`,
    modeCoinche:   'Coinche',
    modeBelote:    'Belote',
  },

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
      noteLabel:    'Votre note',
      noNote:       '(aucune note)',
      back:         'Back',
      nextScenario: 'Scénario suivant',
    },

    errors: {
      sessionInterrupted: 'Session interrompue — consultez les scénarios à reprendre.',
      // Code-keyed error messages — App.jsx looks these up by the server's
      // error.code before falling back to the raw server message.
      byCode: {
        DUPLICATE_BID_IN_SESSION:        "Cette enchère a déjà été enregistrée dans cette session. Choisissez une enchère différente.",
        UNKNOWN_SESSION:                 'Session inconnue ou expirée.',
        MISSING_DIVERGENCE_AGREEMENT:    'Veuillez répondre à la question avant de valider.',
        INVALID_DIVERGENCE_AGREEMENT:    'Réponse invalide.',
        MISSING_REQUIRED_NOTE:           'Une explication est requise pour ce choix.',
        UNEXPECTED_DIVERGENCE_AGREEMENT: 'Erreur de soumission.',
      },
    },

    panel: {
      submit:                    'Valider',
      changeAction:              'Changer mon action',
      // Action-display prefixes — kept for legacy formatActionText callers
      // (e.g. picker resumable rows, completion summary). The new compact
      // labels live in formatActionLabel.jsx and use training.divergence.*.
      youBid:                    'Vous avez annoncé',
      youPassed:                 'Vous avez passé',
      youCoinched:               'Vous avez coinché',
      youSurcoinched:            'Vous avez surcoinché',
      youPlayed:                 'Vous avez joué',
      // Mock-only — not shown outside the mock harness
      mockHarnessHeading:        'Mode démo — panneau de raisonnement',
      mockSwitcherLabel:         'Cas',
      mockStateMatch:            'Match (règle = action)',
      mockStateDivergent:        'Divergence',
      mockStateRuleSilent:       'Règle silencieuse',
    },
    // v3.1 divergence-driven flow — section labels + agree/disagree copy.
    divergence: {
      label: {
        userAction:       'Annonce',
        feuilleSuggests:  'La Feuille suggère',
      },
      option: {
        agree:    'D\'accord',
        disagree: 'Pas d\'accord',
      },
      freeColor: '(couleur libre)',
    },
    ruleSilent: {
      intro: 'La Feuille ne couvre pas ce cas — votre raisonnement nous aide à la construire.',
    },
    reasoning: {
      label:       'Raisonnement',
      required:    '(requis)',
      placeholder: 'Expliquez votre raisonnement...',
    },
    // V2.2 Phase 2C — card selector shown on the completion screen
    // before the conversation opens. User taps cards from their hand
    // that motivated the bid; the selection feeds Claude's system prompt.
    cardSelector: {
      heading:        'Quelles cartes ont motivé ton choix ?',
      hintDivergent:  'Sélectionne les cartes clés. Au moins une carte est requise.',
      hintRuleSilent: 'Sélectionne les cartes clés, ou continue sans sélection.',
      countLabel:     (n) => n === 0
        ? 'Aucune carte sélectionnée'
        : n === 1 ? '1 carte sélectionnée' : `${n} cartes sélectionnées`,
      validateBtn:    'Valider',
      skipBtn:        'Continuer sans sélection',
    },
    // V2.2 Phase 2 — inline Claude conversation that opens after a
    // "Pas d'accord" annotation. Conversation content itself is always
    // French (system prompt locks it); these keys cover the surrounding UI.
    claudeConversation: {
      heading:           'Discussion avec Claude',
      authorClaude:      'Claude',
      loadingFirst:      'Claude prépare sa première question…',
      loadingTurn:       'Claude réfléchit…',
      inputPlaceholder:  'Votre réponse…',
      sendBtn:           'Envoyer',
      endBtn:            'Terminer la discussion',
      errorRetry:        'Erreur de connexion. Réessayer ?',
      retryBtn:          'Réessayer',
      contextHand:       'Votre main',
      contextBidding:    'Enchères',
    },
  },
};
