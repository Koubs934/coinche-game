// v3 (2026-05-04): the structured tag vocabulary was removed alongside the
// divergence-driven UI rewrite. The shared `_sharedBidDecisionTagsEn`
// fragment that lived here is gone — git history preserves it. Annotation
// is now: pick action → (if rules diverge or are silent) free-text note.

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
  settings: 'Settings',
  language: 'Language',
  preferences: 'Preferences',
  modeSacha: 'Mode Sacha',
  sachaOff: 'Alternating colors · trump on left',
  sachaOn: 'Alternating colors · trump anywhere',
  delfinoOff: 'Normal card size',
  delfinoOn: 'Enlarged cards',
  partnerPeek: 'Partner mode',

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
  emptySeat: 'Open seat',
  botLabel: 'bot',
  us: 'Us',
  them: 'Them',
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
  highestBid: 'Highest bid',
  bidSheetCta: 'Bid',
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
  showDetail: 'Show detail ▾',
  hideDetail: 'Hide detail ▴',
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
  leaveShort: 'Leave',   // single-word caption for the compact toolbar (full title stays "Leave table")
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
  opponent: 'Opponent',

  // Misc
  coincheBonus: 'Coinche',
  surcoinchBonus: 'Surcoinche',
  chutePenalty: 'Penalty base',
  contractBase: 'Contract base',
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

  // Throw projectiles
  throw: {
    aim: 'Throw something',
  },

  // Table chat
  chat: {
    title:       'Chat',
    open:        'Open chat',
    placeholder: 'Write a message…',
    send:        'Send',
    empty:       'No messages yet — say hello!',
  },

  // Input validation
  invalidRoomCode: 'Room code must be 6 letters or digits',
  usernameTooShort: 'Username must be at least 2 characters',

  // Game Review — free-text error tagging during live play
  button: {
    tagPlayError: 'Game error',
  },
  overlay: {
    tagPlayError: {
      heading:         'Tag a play error',
      trickLabel:      (n) => `Trick ${n}`,
      currentTrick:    'Current trick',
      // "Trick {{trick}}, player '{{username}}' (seat {{seat}}) played {{card}}"
      cardSelected:    ({ trick, username, seat, card }) =>
                        `Trick ${trick}, player "${username}" (seat ${seat}) played ${card}`,
      notePlaceholder: 'Why is this card a mistake?',
      saveBtn:         'Save',
      cancelBtn:       'Cancel',
    },
  },
  toast: {
    gameRecordSaved: 'Game saved for analysis',
  },
  errors: {
    // Server error codes emitted by the Game Review backend. App.jsx prefers
    // these over the generic server message when a code is present.
    byCode: {
      FORBIDDEN_NOT_ROOM_CREATOR: 'Only the room creator can tag errors.',
      INVALID_CARD_REF:           "That card wasn't played that way in that trick.",
      NOTE_EMPTY:                 "Note can't be empty.",
      NOTE_TOO_LONG:              'Note exceeds the maximum length.',
      UNKNOWN_GAME:               'This game could not be found or has already ended.',
    },
  },

  // Training mode — labels for the reasoning-capture UI.
  // French (fr.js) is the canonical source; these are translations.
  // Keys are immutable (defined in backend/src/training/reasonTags.json)
  // and must not be renamed without migrating stored annotation records.
  // Lobby screen button label
  lobbyTrainingBtn: 'Training',
  // Hint below the Lobby Training button when the user has in-progress partials
  lobbyResumableHint: (n) => n === 1 ? '1 scenario to finish' : `${n} scenarios to finish`,

  // Home / landing screen (layout B)
  lobby: {
    readyToPlay:   'Ready to play',
    createAvatar:  'Create my avatar',
    editAvatar:    'Edit my avatar',
    activeGames:   'Active games',
    noActiveGames: 'No active games',
    refresh:       'Refresh',
    rejoin:        'Rejoin',
    join:          'Join',
    roomLine:      (count, mode) => `${count}/4 · ${mode}`,
    modeCoinche:   'Coinche',
    modeBelote:    'Belote',
    // Amis en ligne (presence)
    friends:       'Friends online',
    friendsOffline:'Offline friends',
    onlineCount:   (n) => `${n} online`,
    noOneOnline:   'No one online',
    statusOnline:  'online',
    statusInGame:  'in game',
    statusOffline: 'offline',
  },

  // Profile screen + avatar builder
  profile: {
    title:     'Profile',
    save:      'Save',
    saving:    'Saving…',
    saved:     'Saved ✓',
    saveError: 'Could not save. Try again.',
    randomize: 'Random',
    back:      'Back',
    features: {
      body:            'Body',
      hair:            'Hair',
      face:            'Face',
      facialHair:      'Beard',
      accessory:       'Glasses',
      colors:          'Colors',
      strokeColor:     'Ink',
      backgroundColor: 'Fill',
    },
  },

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
      noteLabel:    'Your note',
      noNote:       '(no note)',
      back:         'Back',
      nextScenario: 'Next scenario',
    },

    errors: {
      sessionInterrupted: 'Session interrupted — check resumable scenarios.',
      // Code-keyed error messages — App.jsx looks these up by the server's
      // error.code before falling back to the raw server message.
      byCode: {
        DUPLICATE_BID_IN_SESSION:        'This bid was already recorded in this session. Choose a different bid.',
        UNKNOWN_SESSION:                 'Unknown or expired session.',
        MISSING_DIVERGENCE_AGREEMENT:    'Please answer the question before submitting.',
        INVALID_DIVERGENCE_AGREEMENT:    'Invalid response.',
        MISSING_REQUIRED_NOTE:           'An explanation is required for this choice.',
        UNEXPECTED_DIVERGENCE_AGREEMENT: 'Submission error.',
      },
    },

    panel: {
      submit:                    'Submit',
      changeAction:              'Change my action',
      // Action-display prefixes — kept for legacy formatActionText callers
      // (e.g. picker resumable rows, completion summary). The new compact
      // labels live in formatActionLabel.jsx and use training.divergence.*.
      youBid:                    'You bid',
      youPassed:                 'You passed',
      youCoinched:               'You coinched',
      youSurcoinched:            'You surcoinched',
      youPlayed:                 'You played',
      // Mock-only — not shown outside the mock harness
      mockHarnessHeading:        'Mock mode — reason panel preview',
      mockSwitcherLabel:         'Case',
      mockStateMatch:            'Match (rule = action)',
      mockStateDivergent:        'Divergent',
      mockStateRuleSilent:       'Rule-silent',
    },
    // v3.1 divergence-driven flow — section labels + agree/disagree copy.
    divergence: {
      label: {
        userAction:       'Your call',
        feuilleSuggests:  'La Feuille suggests',
      },
      option: {
        agree:    'Agree',
        disagree: 'Disagree',
      },
      freeColor: '(free suit)',
    },
    ruleSilent: {
      intro: "La Feuille doesn't cover this case — your reasoning helps build it.",
    },
    reasoning: {
      label:       'Reasoning',
      required:    '(required)',
      placeholder: 'Explain your reasoning...',
    },
    // V2.2 Phase 2C — card selector shown on the completion screen
    // before the conversation opens. Same source as fr/cardSelector.
    cardSelector: {
      heading:        'Which cards motivated your call?',
      hintDivergent:  'Tap to select the key cards. At least one card is required.',
      hintRuleSilent: 'Tap to select the key cards, or continue without a selection.',
      countLabel:     (n) => n === 0
        ? 'No card selected'
        : n === 1 ? '1 card selected' : `${n} cards selected`,
      validateBtn:    'Validate',
      skipBtn:        'Continue without selection',
    },
    // V2.2 Phase 2 — inline Claude conversation that opens after a
    // "Disagree" annotation. Conversation content itself is always French
    // (the Anthropic system prompt locks it). These keys cover the
    // surrounding UI chrome only.
    claudeConversation: {
      heading:           'Discussion with Claude',
      authorClaude:      'Claude',
      loadingFirst:      'Claude is preparing the first question…',
      loadingTurn:       'Claude is thinking…',
      inputPlaceholder:  'Your response…',
      sendBtn:           'Send',
      endBtn:            'End discussion',
      errorRetry:        'Connection error. Retry?',
      retryBtn:          'Retry',
      contextHand:       'Your hand',
      contextBidding:    'Bidding',
    },
  },
};
