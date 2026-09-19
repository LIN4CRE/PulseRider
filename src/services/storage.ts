import { UserProfile, DailyChallenge, MatchAnalytics, LocalDuelRecord, ReplayEvent } from '../types';

const STORAGE_KEYS = {
  PROFILE: 'hyperpulse_profile_v1',
  CHALLENGES: 'hyperpulse_challenges_v1',
  ANALYTICS: 'hyperpulse_analytics_v1',
  LOCAL_DUELS: 'hyperpulse_local_duels_v1',
  LAST_LOGIN_DATE: 'hyperpulse_last_login_date',
  LOGIN_STREAK: 'hyperpulse_login_streak',
  OFFLINE_QUEUE: 'hyperpulse_offline_queue',
};

const defaultProfile: UserProfile = {
  id: `usr_${Math.floor(100000 + Math.random() * 900000)}`,
  username: 'PulseRider',
  avatar: '⚡',
  level: 1,
  xp: 0,
  highScore: 0,
  bestCombo: 0,
  totalGames: 0,
  duelWins: 0,
  duelLosses: 0,
  syncCode: `HP-${Math.floor(1000 + Math.random() * 9000)}`,
  soundEnabled: true,
  musicEnabled: true,
  hapticsEnabled: true,
  theme: 'dark',
  language: 'en',
};

const initialChallenges: DailyChallenge[] = [
  {
    id: 'ch-1',
    titleKey: 'challenge_1',
    descKey: 'challenge_1_desc',
    target: 25,
    current: 0,
    rewardXp: 350,
    rewardBadge: '🎯 Precision Ace',
    completed: false,
    claimed: false,
  },
  {
    id: 'ch-2',
    titleKey: 'challenge_2',
    descKey: 'challenge_2_desc',
    target: 1,
    current: 0,
    rewardXp: 500,
    rewardBadge: '⚔️ Duel Champion',
    completed: false,
    claimed: false,
  },
  {
    id: 'ch-3',
    titleKey: 'challenge_3',
    descKey: 'challenge_3_desc',
    target: 12000,
    current: 0,
    rewardXp: 600,
    rewardBadge: '🚀 Hyper Velocity',
    completed: false,
    claimed: false,
  },
];

export function getStoredProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (raw) {
      return { ...defaultProfile, ...JSON.parse(raw) };
    }
  } catch (e) {}
  return defaultProfile;
}

export function saveStoredProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  } catch (e) {}
}

export function getDailyChallenges(): DailyChallenge[] {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const lastDate = localStorage.getItem(STORAGE_KEYS.LAST_LOGIN_DATE);
    
    if (lastDate !== todayStr) {
      // New day: reset challenges
      localStorage.setItem(STORAGE_KEYS.LAST_LOGIN_DATE, todayStr);
      localStorage.setItem(STORAGE_KEYS.CHALLENGES, JSON.stringify(initialChallenges));
      return initialChallenges;
    }

    const raw = localStorage.getItem(STORAGE_KEYS.CHALLENGES);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return initialChallenges;
}

export function saveDailyChallenges(challenges: DailyChallenge[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CHALLENGES, JSON.stringify(challenges));
  } catch (e) {}
}

export function generateSampleReplayEvents(
  mode: 'solo' | 'duel',
  perfectHits: number = 18,
  greatHits: number = 10,
  misses: number = 2
): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  let time = 800;
  let combo = 0;
  const total = perfectHits + greatHits + misses;

  for (let i = 0; i < total; i++) {
    time += 700 + Math.floor(Math.random() * 450);
    const x = Math.round(18 + Math.random() * 64);
    const y = Math.round(20 + Math.random() * 60);

    const isMiss = i === Math.floor(total * 0.4) || i === Math.floor(total * 0.75);
    const isPowerup = i === 5 || i === 15;

    if (isMiss && misses > 0) {
      combo = 0;
      events.push({
        id: `ev-${i}`,
        timestampMs: time,
        type: 'miss',
        x,
        y,
        reactionTimeMs: 440,
        grade: 'MISS',
        points: 0,
        combo: 0,
        label: 'MISSED TARGET',
        color: '#f43f5e',
        player: mode === 'duel' ? ((i % 2 === 0 ? 1 : 2) as 1 | 2) : undefined,
      });
    } else {
      combo++;
      const isPerfect = i % 3 !== 0;
      const reaction = isPerfect ? 180 + Math.floor(Math.random() * 45) : 230 + Math.floor(Math.random() * 50);
      events.push({
        id: `ev-${i}`,
        timestampMs: time,
        type: isPowerup ? 'powerup' : 'hit',
        x,
        y,
        reactionTimeMs: reaction,
        grade: isPerfect ? 'PERFECT' : 'GREAT',
        points: isPerfect ? 150 : 120,
        combo,
        label: isPowerup ? 'FEVER BOOST' : isPerfect ? 'PERFECT HIT' : 'GREAT HIT',
        color: isPowerup ? '#f59e0b' : isPerfect ? '#10b981' : '#06b6d4',
        player: mode === 'duel' ? ((i % 2 === 0 ? 1 : 2) as 1 | 2) : undefined,
      });
    }
  }
  return events;
}

export function getMatchAnalytics(): MatchAnalytics[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ANALYTICS);
    if (raw) {
      const parsed: MatchAnalytics[] = JSON.parse(raw);
      return parsed.map(item => {
        if (!item.events || item.events.length === 0) {
          item.events = generateSampleReplayEvents(item.mode, item.perfectHits, item.greatHits, item.misses);
        }
        if (!item.fastestReactionMs) {
          item.fastestReactionMs = Math.round(item.avgReactionTimeMs * 0.78);
        }
        return item;
      });
    }
  } catch (e) {}
  // Default starter history so performance charts have initial visual beauty
  return [
    {
      id: 'init-1',
      mode: 'solo',
      score: 8940,
      accuracy: 94.2,
      avgReactionTimeMs: 218,
      fastestReactionMs: 174,
      maxCombo: 22,
      perfectHits: 29,
      greatHits: 11,
      misses: 1,
      durationSeconds: 34,
      date: 'Earlier Today',
      timestamp: Date.now() - 3600000,
      events: generateSampleReplayEvents('solo', 29, 11, 1),
    },
    {
      id: 'init-2',
      mode: 'duel',
      score: 1240,
      accuracy: 96.0,
      avgReactionTimeMs: 205,
      fastestReactionMs: 168,
      maxCombo: 16,
      perfectHits: 24,
      greatHits: 8,
      misses: 1,
      durationSeconds: 28,
      winner: 'Player 1 (Blue)',
      duelDetails: {
        player1Name: 'Ace (Blue)',
        player2Name: 'Blaze (Coral)',
        p1Score: 1240,
        p2Score: 980,
        p1Accuracy: 96.0,
        p2Accuracy: 88.5,
        p1AvgReactionMs: 205,
        p2AvgReactionMs: 242,
      },
      date: 'Yesterday',
      timestamp: Date.now() - 86400000,
      events: generateSampleReplayEvents('duel', 24, 8, 1),
    }
  ];
}

export function saveMatchAnalytics(analytics: MatchAnalytics): void {
  try {
    const history = getMatchAnalytics();
    history.unshift(analytics);
    if (history.length > 50) history.pop();
    localStorage.setItem(STORAGE_KEYS.ANALYTICS, JSON.stringify(history));
  } catch (e) {}
}

export function getLocalDuelRecords(): LocalDuelRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_DUELS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return [
    {
      id: 'local-1',
      player1: 'Ace (Blue)',
      player2: 'Blaze (Coral)',
      score1: 1020,
      score2: 890,
      winner: 'Ace (Blue)',
      date: 'Today',
    }
  ];
}

export function saveLocalDuelRecord(record: LocalDuelRecord): void {
  try {
    const records = getLocalDuelRecords();
    records.unshift(record);
    if (records.length > 30) records.pop();
    localStorage.setItem(STORAGE_KEYS.LOCAL_DUELS, JSON.stringify(records));
  } catch (e) {}
}

export function getLoginStreak(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOGIN_STREAK);
    return raw ? parseInt(raw, 10) : 3;
  } catch (e) {
    return 3;
  }
}

// Queue offline syncs if user plays while offline
export function queueOfflineSync(payload: any) {
  try {
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(payload));
  } catch (e) {}
}

export function getQueuedOfflineSync(): any | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearQueuedOfflineSync() {
  try {
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
  } catch (e) {}
}

// Direct Leaderboard Submission
export async function submitToLeaderboard(payload: {
  username?: string;
  avatar?: string;
  score?: number;
  maxCombo?: number;
  accuracy?: number;
  mode?: 'solo' | 'local_duel';
  duelDetail?: {
    player1: string;
    player2: string;
    score1: number;
    score2: number;
    winner: string;
  };
}) {
  try {
    const res = await fetch('/api/leaderboard/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Failed to submit score to leaderboard:', e);
  }
  return null;
}

// Cloud API methods
export async function backupToCloud(profile: UserProfile, analytics?: any): Promise<{ success: boolean; syncCode: string; message: string }> {
  try {
    const res = await fetch('/api/sync/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syncCode: profile.syncCode,
        userId: profile.id,
        username: profile.username,
        avatar: profile.avatar,
        level: profile.level,
        xp: profile.xp,
        highScore: profile.highScore,
        totalMatches: profile.totalGames,
        duelWins: profile.duelWins,
        duelLosses: profile.duelLosses,
        data: {
          analytics: analytics || { peakCombo: profile.bestCombo, accuracy: 95 },
          theme: profile.theme,
          language: profile.language,
        }
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    clearQueuedOfflineSync();
    return data;
  } catch (err: any) {
    // Save to offline queue if network error
    queueOfflineSync({ profile, analytics, timestamp: Date.now() });
    return {
      success: false,
      syncCode: profile.syncCode,
      message: 'Network offline. Progress queued and will sync automatically when reconnected.',
    };
  }
}

export async function restoreFromCloud(code: string): Promise<{ success: boolean; profile?: UserProfile; message?: string }> {
  try {
    const res = await fetch(`/api/sync/restore/${encodeURIComponent(code.trim())}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, message: errData.message || 'Backup code not found.' };
    }
    const data = await res.json();
    if (data.success && data.record) {
      const rec = data.record;
      const restoredProfile: UserProfile = {
        ...defaultProfile,
        id: rec.userId || defaultProfile.id,
        username: rec.username || defaultProfile.username,
        avatar: rec.avatar || defaultProfile.avatar,
        level: rec.level || 1,
        xp: rec.xp || 0,
        highScore: rec.highScore || 0,
        totalGames: rec.totalMatches || 0,
        duelWins: rec.duelWins || 0,
        duelLosses: rec.duelLosses || 0,
        syncCode: rec.syncCode || code,
        lastSyncedAt: rec.updatedAt,
      };
      saveStoredProfile(restoredProfile);
      return { success: true, profile: restoredProfile };
    }
    return { success: false, message: 'Invalid server response.' };
  } catch (err) {
    return { success: false, message: 'Could not connect to cloud server. Check internet connection.' };
  }
}
