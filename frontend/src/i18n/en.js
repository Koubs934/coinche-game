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
  announceBelote: 'Announce Belote/Rebelote',

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
  coinched: 'Coinched',
  surcoinched: 'Surcoinched',
  dixDeDer: '+10 (dix de der)',
  sortHand: 'Sort',
  lastTrick: 'Last trick',
  wonTrick: 'won the trick',
  liveRound: 'Round',
};
