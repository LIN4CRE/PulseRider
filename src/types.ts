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
  speedPreference?: 'standard' | 'turbo' | 'overdrive';
}

export interface ReplayEvent {
  id: string;
  timestampMs: number; // ms from match start
  type: 'hit' | 'miss' | 'hazard' | 'powerup' | 'sabotage';
  x: number; // 10-90 percentage
  y: number; // 10-90 percentage
  reactionTimeMs?: number;
  grade?: 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS' | 'HAZARD';
  points?: number;
  combo?: number;
  label?: string;
  player?: 1 | 2; // For duel matches
  color?: string;
}

export interface MatchAnalytics {
  id: string;
  mode: 'solo' | 'duel';
  score: number;
  accuracy: number;
  avgReactionTimeMs: number;
  fastestReactionMs?: number;
  maxCombo: number;
  perfectHits: number;
  greatHits: number;
  misses: number;
  date: string;
  timestamp: number;
  durationSeconds?: number;
  winner?: string;
  duelDetails?: {
    player1Name: string;
    player2Name: string;
    p1Score: number;
    p2Score: number;
    p1Accuracy?: number;
    p2Accuracy?: number;
    p1AvgReactionMs?: number;
    p2AvgReactionMs?: number;
    p1Hits?: number;
    p2Hits?: number;
  };
  events?: ReplayEvent[];
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
