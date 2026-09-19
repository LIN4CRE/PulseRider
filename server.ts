import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface CloudSyncRecord {
  syncCode: string;
  userId: string;
  username: string;
  avatar: string;
  level: number;
  xp: number;
  highScore: number;
  totalMatches: number;
  duelWins: number;
  duelLosses: number;
  updatedAt: string;
  data: any;
}

interface LeaderboardEntry {
  id: string;
  username: string;
  avatar: string;
  score: number;
  maxCombo: number;
  accuracy: number;
  rank: string;
  region: string;
  timestamp: string;
  isLocalDuel?: boolean;
  wins?: number;
  losses?: number;
}

const cloudSyncStore = new Map<string, CloudSyncRecord>();

// Pre-populate realistic social & global competitive leaderboard
let leaderboard: LeaderboardEntry[] = [
  { id: "lb-1", username: "NovaRider", avatar: "⚡", score: 48920, maxCombo: 54, accuracy: 98.4, rank: "Apex Legend", region: "NA", timestamp: "10m ago" },
  { id: "lb-2", username: "PulseQueen", avatar: "👑", score: 46210, maxCombo: 49, accuracy: 97.8, rank: "Apex Legend", region: "EU", timestamp: "25m ago" },
  { id: "lb-3", username: "CyberStrike", avatar: "🎯", score: 43150, maxCombo: 42, accuracy: 96.5, rank: "Diamond I", region: "JP", timestamp: "1h ago" },
  { id: "lb-4", username: "KitsuneTap", avatar: "🦊", score: 40800, maxCombo: 38, accuracy: 95.2, rank: "Diamond II", region: "KR", timestamp: "2h ago" },
  { id: "lb-5", username: "NeonSamurai", avatar: "⚔️", score: 38450, maxCombo: 36, accuracy: 94.8, rank: "Platinum I", region: "BR", timestamp: "3h ago" },
  { id: "lb-6", username: "ZeroLag", avatar: "🚀", score: 35900, maxCombo: 34, accuracy: 93.9, rank: "Platinum II", region: "AU", timestamp: "5h ago" },
  { id: "lb-7", username: "GhostFinger", avatar: "👻", score: 32400, maxCombo: 30, accuracy: 92.1, rank: "Gold I", region: "CA", timestamp: "8h ago" },
  { id: "lb-8", username: "ChronoDrift", avatar: "⏱️", score: 29800, maxCombo: 28, accuracy: 90.7, rank: "Gold II", region: "UK", timestamp: "12h ago" },
];

let localDuelLeaderboard = [
  { id: "duel-1", player1: "Player 1 (Ace)", player2: "Player 2 (Blaze)", score1: 1040, score2: 980, winner: "Player 1 (Ace)", date: "Today, 10:14" },
  { id: "duel-2", player1: "Player 1 (Ace)", player2: "Player 2 (Blaze)", score1: 890, score2: 1010, winner: "Player 2 (Blaze)", date: "Today, 09:45" },
  { id: "duel-3", player1: "Speedy", player2: "RivalX", score1: 1200, score2: 1140, winner: "Speedy", date: "Yesterday" },
];

const upcomingEvents = [
  {
    id: "evt-1",
    title: "Global Pulse Sprint Cup",
    type: "tournament",
    startsIn: "2h 45m",
    scheduledTimestamp: Date.now() + 2 * 3600 * 1000 + 45 * 60 * 1000,
    reward: "1,500 XP + 'Neon Lightning' Badge",
    description: "Compete against global tap speeds. Triple combo points enabled!",
    badge: "🔥 Hot Event"
  },
  {
    id: "evt-2",
    title: "Local Duel Championship",
    type: "local_rivalry",
    startsIn: "6h 15m",
    scheduledTimestamp: Date.now() + 6 * 3600 * 1000,
    reward: "Exclusive 'Duel Monarch' Title",
    description: "Challenge your friends to 3 head-to-head matches.",
    badge: "⚔️ Competitive"
  },
  {
    id: "evt-3",
    title: "Midnight Reflex Surge",
    type: "frenzy",
    startsIn: "14h 00m",
    scheduledTimestamp: Date.now() + 14 * 3600 * 1000,
    reward: "2,000 XP + Gold Frame",
    description: "2x multiplier during late-night hours. Test your reaction limits.",
    badge: "🌙 Night Blitz"
  }
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Cloud Sync: Backup endpoint
  app.post("/api/sync/backup", (req, res) => {
    try {
      const { syncCode, userId, username, avatar, level, xp, highScore, totalMatches, duelWins, duelLosses, data } = req.body;
      
      const code = (syncCode && syncCode.trim().length > 3) 
        ? syncCode.trim().toUpperCase() 
        : `HP-${Math.floor(1000 + Math.random() * 9000)}`;

      const record: CloudSyncRecord = {
        syncCode: code,
        userId: userId || `usr_${Date.now()}`,
        username: username || "Player",
        avatar: avatar || "⚡",
        level: level || 1,
        xp: xp || 0,
        highScore: highScore || 0,
        totalMatches: totalMatches || 0,
        duelWins: duelWins || 0,
        duelLosses: duelLosses || 0,
        updatedAt: new Date().toISOString(),
        data: data || {},
      };

      cloudSyncStore.set(code, record);

      // Also update leaderboard if highScore is competitive
      if (highScore > 0) {
        const existingIndex = leaderboard.findIndex(e => e.username.toLowerCase() === username.toLowerCase());
        const entry: LeaderboardEntry = {
          id: existingIndex >= 0 ? leaderboard[existingIndex].id : `user-${Date.now()}`,
          username: username || "Player",
          avatar: avatar || "⚡",
          score: highScore,
          maxCombo: data?.analytics?.peakCombo || 25,
          accuracy: data?.analytics?.accuracy || 94.0,
          rank: highScore > 30000 ? "Apex Legend" : highScore > 20000 ? "Diamond" : highScore > 10000 ? "Platinum" : "Gold",
          region: "LOCAL",
          timestamp: "Just now",
        };
        if (existingIndex >= 0) {
          if (highScore > leaderboard[existingIndex].score) {
            leaderboard[existingIndex] = entry;
          }
        } else {
          leaderboard.push(entry);
        }
        leaderboard.sort((a, b) => b.score - a.score);
      }

      res.json({
        success: true,
        syncCode: code,
        syncedAt: record.updatedAt,
        message: "Cloud progress successfully synchronized and secured!",
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || "Sync failed" });
    }
  });

  // Cloud Sync: Restore endpoint
  app.get("/api/sync/restore/:code", (req, res) => {
    const code = req.params.code?.toUpperCase().trim();
    if (!code || !cloudSyncStore.has(code)) {
      return res.status(404).json({
        success: false,
        message: `No cloud backup found for sync code "${code}". Please check your code.`,
      });
    }

    const record = cloudSyncStore.get(code);
    res.json({
      success: true,
      syncCode: code,
      record,
    });
  });

  // Leaderboard endpoints
  app.get("/api/leaderboard", (_req, res) => {
    res.json({
      global: leaderboard,
      localDuel: localDuelLeaderboard,
    });
  });

  const handleLeaderboardSubmit = (req: express.Request, res: express.Response) => {
    const { username, avatar, score, maxCombo, accuracy, mode, duelDetail } = req.body;

    if (mode === "local_duel" && duelDetail) {
      localDuelLeaderboard.unshift({
        id: `duel-${Date.now()}`,
        player1: duelDetail.player1,
        player2: duelDetail.player2,
        score1: duelDetail.score1,
        score2: duelDetail.score2,
        winner: duelDetail.winner,
        date: "Just now",
      });
      if (localDuelLeaderboard.length > 20) localDuelLeaderboard.pop();
      return res.json({ success: true, localDuel: localDuelLeaderboard });
    }

    if (score !== undefined && username) {
      const existing = leaderboard.find(l => l.username.toLowerCase() === username.toLowerCase());
      if (existing) {
        if (score > existing.score) {
          existing.score = score;
          existing.maxCombo = Math.max(existing.maxCombo, maxCombo || 0);
          existing.accuracy = accuracy || existing.accuracy;
          existing.timestamp = "Just now";
        }
      } else {
        leaderboard.push({
          id: `lb-${Date.now()}`,
          username,
          avatar: avatar || "⚡",
          score: Number(score),
          maxCombo: Number(maxCombo || 0),
          accuracy: Number(accuracy || 90.0),
          rank: score > 35000 ? "Apex Legend" : score > 20000 ? "Diamond" : "Platinum",
          region: "MY",
          timestamp: "Just now",
        });
      }
      leaderboard.sort((a, b) => b.score - a.score);
    }

    res.json({ success: true, global: leaderboard });
  };

  app.post("/api/leaderboard/submit", handleLeaderboardSubmit);
  app.post("/api/leaderboard", handleLeaderboardSubmit);

  // Events & Notifications endpoint
  app.get("/api/events", (_req, res) => {
    res.json({ events: upcomingEvents });
  });

  // Vite middleware for development vs static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
