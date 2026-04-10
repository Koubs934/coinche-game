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
  announceBelote: 'Annoncer Belote / Rebelote',

  // Scores
  score: 'Score',
  roundScore: 'Score du tour',
  totalScore: 'Total',
  team: 'Équipe',
  contractMade: 'Contrat réussi !',
  contractFailed: 'Contrat chuté',
  roundOver: 'Fin du tour',
  nextRound: 'Tour suivant',
  gameOver: 'Fin de partie !',
  winner: 'Vainqueur',
  wins: 'gagne !',
  playAgain: 'Nouvelle partie',

  // Disconnect
  playerDisconnected: (name) => `${name} s'est déconnecté. En attente de reconnexion...`,
  gamePaused: "Partie en pause — en attente d'un joueur",
  reconnecting: 'Reconnexion...',

  // Suits
  suitName: { S: 'Pique', H: 'Cœur', D: 'Carreau', C: 'Trèfle' },
  suitSymbol: { S: '♠', H: '♥', D: '♦', C: '♣' },

  // Positions
  you: 'Vous',
  partner: 'Partenaire',
  left: 'Gauche',
  right: 'Droite',

  // Misc
  coinched: 'Coinché ×2',
  surcoinched: 'Surcoinché ×4',
  dixDeDer: '+10 (dix de der)',
  sortHand: 'Trier',
  lastTrick: 'Dernier pli',
  wonTrick: 'a remporté le pli',
  liveRound: 'Pli en cours',
};
