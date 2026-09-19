export type Language = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'pt';

export type GameMode = 'menu' | 'solo' | 'duel' | 'leaderboard' | 'analytics' | 'challenges' | 'tutorial';

export interface UserProfile {
  id: string;
  username: string;
  avatar: string;
  level: number;
  xp: number;
  highScore: number;
  bestCombo: number;
  totalGames: number;
  duelWins: number;
  duelLosses: number;
  syncCode: string;
  lastSyncedAt?: string;
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  theme: 'dark' | 'light';
  language: Language;
}

export interface MatchAnalytics {
  id: string;
  mode: 'solo' | 'duel';
  score: number;
  accuracy: number;
  avgReactionTimeMs: number;
  maxCombo: number;
  perfectHits: number;
  greatHits: number;
  misses: number;
  date: string;
  timestamp: number;
  winner?: string;
}

export interface DailyChallenge {
  id: string;
  titleKey: string;
  descKey: string;
  target: number;
  current: number;
  rewardXp: number;
  rewardBadge: string;
  completed: boolean;
  claimed: boolean;
}

export interface LocalDuelRecord {
  id: string;
  player1: string;
  player2: string;
  score1: number;
  score2: number;
  winner: string;
  date: string;
}

export interface GlobalLeaderboardItem {
  id: string;
  username: string;
  avatar: string;
  score: number;
  maxCombo: number;
  accuracy: number;
  rank: string;
  region: string;
  timestamp: string;
}

export interface PulseTarget {
  id: number;
  x: number; // percentage 10-90
  y: number; // percentage 10-90
  radius: number;
  spawnTime: number;
  duration: number;
  points: number;
  type: 'standard' | 'golden' | 'hazard' | 'freeze' | 'surge';
  color: string;
  tapped?: boolean;
}

export interface GameEvent {
  id: string;
  title: string;
  type: string;
  startsIn: string;
  scheduledTimestamp: number;
  reward: string;
  description: string;
  badge: string;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  description: string;
  startTime: string;
  duration: string;
  reward: string;
  active: boolean;
}
