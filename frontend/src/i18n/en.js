// ── Training tag labels (shared fragments) ───────────────────────────────────
// Mirrors _sharedBidDecisionTagsFr in fr.js. French is canonical; several
// entries preserve French terms (Maître, Belote, Bicolore, Longue, etc.) —
// these are conventional names in Coinche / Belote, not translatable.
const _sharedBidDecisionTagsEn = {
  // Group 1 — Trump hand
  'maitre':             'Maître (J+9+A trump)',
  'valet-second':       'J-second (2 trumps incl. J)',
  'valet-troisième':    'J-third (3 trumps incl. J)',
  'valet-quatrième':    'J-fourth (4 trumps incl. J)',
  'valet-cinquième':    'J-fifth (5 trumps incl. J)',
  '9-second':           '9-second (2 trumps, no J)',
  '9-troisième':        '9-third (3 trumps, no J)',
  '9-quatrième':        '9-fourth (4 trumps, no J)',
  '9-cinquième':        '9-fifth (5 trumps, no J)',
  'atout-count-2':      '2 trumps',
  'atout-count-3':      '3 trumps',
  'atout-count-4':      '4 trumps',
  'atout-count-5-plus': '5+ trumps',
  'belote-possible':    'Belote (K+Q trump)',

  // Group 2 — Non-trump hand
  'as-extérieur-0': '0 outside Aces',
  'as-extérieur-1': '1 outside Ace',
  'as-extérieur-2': '2 outside Aces',
  'as-extérieur-3': '3 outside Aces',
  'deux-as-bare':   '2 Aces (informational)',
  '21':             '21 (A + 10 same suit)',
  'deux-21':        'Two 21s',
  'longue':         'Longue (A-10-K in one suit)',

  // Group 3 — Hand shape
  'bicolore':       'Bicolore (2-suited)',
  'fausse-carte-1': '1 weak off-suit card',
  'fausse-carte-2': '2 weak off-suit cards',

  // Group 5 — Partner context
  'premier-à-parler':              'First to speak',
  'partenaire-ouverture-80':       'Partner opened 80',
  'partenaire-ouverture-90':       'Partner opened 90',
  'partenaire-ouverture-100':      'Partner opened 100',
  'partenaire-ouverture-110-plus': 'Partner opened 110+',
  'partenaire-même-couleur':       'Partner in my suit',
  'partenaire-autre-couleur':      'Partner in different suit',

  // Group 6 — Opponent context
  'adverse-a-ouvert':     'Opponent opened',
  'adverse-a-surenchéri': 'Opponent raised',

  // Group 7 — Score context
  'score-équilibré': 'Score balanced',
  'score-derrière':  'Behind, need points',
  'score-avance':    'Ahead, play safe',
  'dernière-donne':  'Last hand of match',

  // Group 8 — Uncertainty / meta
  'jugement':  'Judgment',
  'incertain': 'Uncertain',
  'autre':     'Other (note required)',
};

export default {
  // Auth
  signIn: 'Sign In',
  signUp: 'Sign Up',
  email: 'Email',
  username: 'Username',
  password: 'Password',
  haveAccount: 'Already have an account?',
  noAccount: "Don't have an account?",
  signOut: 'Sign Out',

  // Lobby
  createRoom: 'Create Room',
  joinRoom: 'Join Room',
  roomCode: 'Room Code',
  join: 'Join',
  waitingForPlayers: 'Waiting for players...',
  playersJoined: (n) => `${n}/4 players`,
  shareCode: 'Share this code with friends:',
  startGame: 'Start Game',
  targetScore: 'Target Score',
  team1: 'Team 1',
  team2: 'Team 2',
  assignTeams: 'Assign Teams',
  moveToTeam1: 'Move to Team 1',
  moveToTeam2: 'Move to Team 2',
  needFourPlayers: 'Need 4 players to start',
  needEqualTeams: 'Each team must have 2 players',
  youAreCreator: 'You are the room creator',
  fillWithBots: 'Fill with Bots',
  bot: 'Bot',

  // Game
  bid: 'Bid',
  pass: 'Pass',
  coinche: 'Coinche!',
  surcoinche: 'Surcoinche!',
  trump: 'Trump',
  contract: 'Contract',
  yourTurn: 'Your turn',
  waitingFor: (name) => `Waiting for ${name}...`,
  biddingPhase: 'Bidding',
  playingPhase: 'Playing',
  capot: 'Capot',
  belote: 'Belote',
  rebelote: 'Rebelote',
  announceBelote: 'Declare Belote?',
  no: 'No',

  // Scores
  score: 'Score',
  trickPoints: 'Trick points',
  announcedPoints: 'Contract value',
  roundScore: 'Round score',
  totalScore: 'Total',
  team: 'Team',
  contractMade: 'Contract made!',
  contractFailed: 'Contract failed',
  roundOver: 'Round Over',
  nextRound: 'Next Round',
  readyCount: (n, total) => `${n} / ${total} ready — waiting…`,
  seeAllTricks: 'See all tricks',
  allTricks: 'All Tricks',
  trick: 'Trick',
  gameOver: 'Game Over!',
  winner: 'Winner',
  wins: 'wins!',
  playAgain: 'New Game',

  // Leave / remove
  leaveTable: 'Leave table',
  leaveConfirmLobby: 'Leave this room?',
  leaveConfirmGame: 'Leave the table? The game will be paused until someone takes your seat.',
  removePlayer: 'Remove',
  removeConfirm: (name) => `Remove ${name}? The game will be paused until someone fills their seat.`,
  removeConfirmLobby: (name) => `Remove ${name} from the room?`,

  // Admin panel
  managePlayers: 'Manage',
  managePlayersTitle: 'Manage Players',
  adminBadge: 'Admin',
  seat: 'Seat',

  // Pending join
  waitingApproval: 'Waiting for approval',
  waitingApprovalMsg: 'Your request to join has been sent. Waiting for the room admin to accept.',
  cancelRequest: 'Cancel request',
  pendingJoinsLabel: 'Wants to join:',
  acceptJoin: 'Accept',
  pendingJoinsWaiting: 'A player is waiting to join — admin approval needed',

  // Disconnect
  playerDisconnected: (name) => `${name} disconnected. Waiting for reconnection...`,
  gamePaused: 'Game paused — a seat is open',
  reconnecting: 'Reconnecting...',
  reconnected: 'Reconnected',
  reconnectedYourTurn: 'Reconnected — your turn',

  // Suits
  suitName: { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' },
  suitSymbol: { S: '♠', H: '♥', D: '♦', C: '♣' },

  // Positions
  you: 'You',
  partner: 'Partner',
  left: 'Left',
  right: 'Right',

  // Misc
  coincheBonus: 'Coinche',
  surcoinchBonus: 'Surcoinche',
  chutePenalty: 'Penalty base',
  replayBtn: 'Replay',
  replayPrev: 'Previous',
  replayNext: 'Next',
  replayEnd: 'Back to summary',
  trickLead: 'Lead',
  firstToSpeak: 'First to bid',
  coinched: 'Coinched',
  surcoinched: 'Surcoinched',
  dixDeDer: '+10 (dix de der)',
  sortHand: 'Sort',
  sortManual: 'Manual',
  lastTrick: 'Last trick',
  wonTrick: 'won the trick',
  liveRound: 'Round',

  // Shuffle / Cut
  shuffle: 'Shuffle',
  noShuffle: "Don't shuffle",
  cut: 'Cut',
  noCut: "Don't cut",
  yourTurnShuffle: 'Your turn to shuffle',
  yourTurnCut: 'Your turn to cut',
  waitingShuffle: (name) => `Waiting for ${name} to shuffle...`,
  waitingCut: (name) => `Waiting for ${name} to cut...`,
  pickCutValue: 'Choose cut position',
  deckShuffled:    (name) => `${name} shuffled`,
  deckNotShuffled: (name) => `${name} didn't shuffle`,
  deckCut:         (name) => `${name} cut`,
  deckNotCut:      (name) => `${name} didn't cut`,

  // Undo
  undoAction: 'Undo',

  // Input validation
  invalidRoomCode: 'Room code must be 6 letters or digits',
  usernameTooShort: 'Username must be at least 2 characters',

  // Training mode — labels for the reasoning-capture UI.
  // French (fr.js) is the canonical source; these are translations.
  // Keys are immutable (defined in backend/src/training/reasonTags.json)
  // and must not be renamed without migrating stored annotation records.
  // Lobby screen button label
  lobbyTrainingBtn: 'Training',
  // Hint below the Lobby Training button when the user has in-progress partials
  lobbyResumableHint: (n) => n === 1 ? '1 scenario to finish' : `${n} scenarios to finish`,

  training: {
    // Confirm + button label when the user leaves a training run
    abandonConfirm: 'Abandon this scenario? Your annotation will be discarded.',
    abandonLabel:   'Abandon',

    picker: {
      title:             'Training scenarios',
      subtitle:          'Play scenarios and record your reasoning.',
      empty:             'No scenarios available.',
      resumableHeading:  'Resume an in-progress annotation',
      resumableAgeMin:   (n) => `started ${n} min ago`,
      actionShown:       'Last action:',
      resumeBtn:         'Resume',
      discardBtn:        'Discard',
      startBtn:          'Start',
      back:              'Back',
      // Exhaustion rendering
      scenariosToAnnotate:  (n) => n === 1 ? '1 scenario to annotate' : `${n} scenarios to annotate`,
      showCompleted:        (n) => `Show completed scenarios (${n})`,
      hideCompleted:        'Hide completed scenarios',
      completedSection:     'Completed scenarios',
      completedBadge:       'Completed',
      alternativesRecorded: (n) => n === 1 ? '1 strategy recorded' : `${n} strategies recorded`,
    },
    completion: {
      title:        'Scenario complete',
      actionLabel:  'Your action',
      tagsLabel:    'Tags selected',
      noteLabel:    'Your note',
      noTags:       '(no tags selected)',
      noNote:       '(no note)',
      backToPicker: 'Back to scenarios',
      nextScenario: 'Next scenario',
    },

    errors: {
      sessionInterrupted: 'Session interrupted — check resumable scenarios.',
      // Code-keyed error messages — App.jsx looks these up by the server's
      // error.code before falling back to the raw server message.
      byCode: {
        DUPLICATE_BID_IN_SESSION: 'This bid was already recorded in this session. Choose a different bid.',
        UNKNOWN_SESSION:          'Unknown or expired session.',
      },
    },

    panel: {
      title:                     'Why this choice?',
      actionLabel:               'Action taken',
      notePlaceholderOptional:   'Optional — what pushed you toward this choice?',
      notePlaceholderRequired:   "Required — what reasoning isn't captured by the tags?",
      noteLabel:                 'Note',
      submit:                    'Submit',
      // Client-side validation helpers (mirror tagValidator.js)
      helperEmpty:               'Pick at least one tag or write a note',
      helperNoteRequired:        'A note is required for the selected tag',
      helperMissingRequired:     (groupLabel) => `Pick one tag from "${groupLabel}"`,
      helperMultipleRequired:    (groupLabel) => `Only one tag allowed in "${groupLabel}"`,
      requiredBadge:             'Required',
      // Soft-warning confirmation overlay (server-returned, non-blocking)
      warningHeading:            'Check your choice',
      warningContinueBtn:        'Continue',
      warningBackBtn:            'Go back and add',
      // Post-completion exhaustion review overlay
      reviewPromptTitle:         'Another strategy possible?',
      reviewPromptBody:          'If you can imagine a different read of this hand leading to a different bid, explore it.',
      reviewContinueBtn:         'Yes, another strategy',
      reviewEndBtn:              "No, that's all",
      changeAction:              'Change my action',
      // Action-display prefixes
      youBid:                    'You bid',
      youPassed:                 'You passed',
      youCoinched:               'You coinched',
      youSurcoinched:            'You surcoinched',
      youPlayed:                 'You played',
      // Mock-only — not shown outside the mock harness
      mockHarnessHeading:        'Mock mode — reason panel preview',
      mockSwitcherLabel:         'Action type',
    },
    actions: {
      bid:         'Bid',
      pass:        'Pass',
      coinche:     'Coinche',
      surcoinche:  'Surcoinche',
      'play-card': 'Card play',
    },
    tags: {
      groups: {
        // v2 groups (bid/pass/coinche/surcoinche)
        'trump-hand':       'Trump hand',
        'non-trump-hand':   'Non-trump hand',
        'hand-shape':       'Hand shape',
        'bidding-action':   'Bidding action',
        'partner-context':  'Partner context',
        'opponent-context': 'Opponent context',
        'score-context':    'Score context',
        'meta':             'Uncertainty / meta',
        // Legacy groups — still used by the (v1-carried-over) play-card action
        'hand-claim':     'Hand strength',
        'tactical':       'Tactical',
        'partner-signal': 'Partner signal',
        'defensive':      'Defensive',
        'situational':    'Situational',
        'uncertainty':    'Uncertainty',
        'other':          'Other',
      },
      bid: {
        ..._sharedBidDecisionTagsEn,
        // Group 4 — Bidding action (bid-specific)
        'ouverture':                   'Opening',
        'monter':                      'Raise (same suit)',
        'changer':                     'Switch suit',
        'bloquage':                    'Blocking bid',
        'faire-monter-pour-coincher':  'Push to draw coinche',
        'cherche-mon-partenaire':      'Information bid to partner',
        'surenchère-compétitive':      'Competitive raise',
      },
      pass: {
        ..._sharedBidDecisionTagsEn,
        // Group 4 — Bidding action (pass-specific)
        'passer-faible':      'Pass (weak hand)',
        'passer-stratégique': 'Pass (strategic)',
      },
      coinche: {
        ..._sharedBidDecisionTagsEn,
        'coincher': 'Coinche',
      },
      surcoinche: {
        ..._sharedBidDecisionTagsEn,
        'surcoincher': 'Surcoinche',
      },
      'play-card': {
        'cashing-winner-before-cut':  'Cashing winner before cut',
        'drawing-trump':              'Drawing trump',
        'promoting-partners-card':    "Promoting partner's card",
        'letting-partner-win':        'Letting partner win',
        'signalling-suit-to-partner': 'Signalling suit to partner',
        'belote-order-signal':        'Belote order signal (K/Q)',
        'appel-direct':               'Appel direct',
        'appel-indirect':             'Appel indirect',
        'protecting-high-card':       'Protecting high card',
        'saving-trump-for-later':     'Saving trump for later',
        'dumping-garbage':            'Dumping garbage',
        'forced-only-legal-card':     'Forced — only legal card',
        'non-default-winner-choice':  'Non-default winner choice',
        'shedding-to-create-ruff':    'Shedding to create a ruff',
        'forcing-opponent-to-trump':  'Forcing opponent to trump',
        'endgame-positioning':        'Endgame positioning (tricks 6-7)',
        'last-trick-dix-de-der':      'Dix de der (last trick)',
        'judgment-call':              'Judgment call',
        'not-sure':                   'Not sure',
        'other':                      'Other',
      },
    },
  },
};
