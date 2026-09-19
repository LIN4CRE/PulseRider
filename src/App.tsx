import React, { useState, useEffect } from 'react';
import { Play, Swords, Trophy, Activity, Gift, HelpCircle, User, Zap, Sparkles, Flame, Shield, Share2 } from 'lucide-react';
import { UserProfile, MatchAnalytics, LocalDuelRecord } from './types';
import {
  getStoredProfile,
  saveStoredProfile,
  saveMatchAnalytics,
  saveLocalDuelRecord,
  getDailyChallenges,
  saveDailyChallenges,
  getQueuedOfflineSync,
  backupToCloud,
} from './services/storage';
import { Header } from './components/Header';
import { SoloGame } from './components/SoloGame';
import { LocalDuelGame } from './components/LocalDuelGame';
import { LeaderboardView } from './components/LeaderboardView';
import { AnalyticsView } from './components/AnalyticsView';
import { ChallengesView } from './components/ChallengesView';
import { TutorialModal } from './components/TutorialModal';
import { ProfileModal } from './components/ProfileModal';
import { EventsModal } from './components/EventsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { translations } from './i18n/translations';
import { soundEngine, triggerHaptic } from './services/audio';

type ViewMode = 'menu' | 'solo' | 'duel' | 'leaderboard' | 'analytics' | 'challenges';

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(getStoredProfile);
  const [view, setView] = useState<ViewMode>('menu');

  // Modals
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);

  const t = translations[profile.language] || translations.en;
  const isDark = profile.theme === 'dark';

  // Apply dark class to html document element
  useEffect(() => {
    if (profile.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [profile.theme]);

  // Audio configuration sync
  useEffect(() => {
    soundEngine.setEnabled(profile.soundEnabled);
    soundEngine.setMusicEnabled(profile.musicEnabled ?? true);
  }, [profile.soundEnabled, profile.musicEnabled]);

  // Handle automatic background sync when returning online
  useEffect(() => {
    const handleOnline = async () => {
      const queued = getQueuedOfflineSync();
      if (queued) {
        await backupToCloud(profile);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [profile]);

  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    setProfile(prev => {
      const next = { ...prev, ...updated };
      saveStoredProfile(next);
      return next;
    });
  };

  // Solo match complete
  const handleSoloGameOver = (analytics: MatchAnalytics, newHighScore: boolean) => {
    saveMatchAnalytics(analytics);

    // Update Daily Challenge progress (e.g. hits and scores)
    const challenges = getDailyChallenges();
    let updatedCh = false;
    const newChallenges = challenges.map(c => {
      if (c.id === 'ch-1') {
        const nextVal = c.current + analytics.perfectHits;
        updatedCh = true;
        return {
          ...c,
          current: nextVal,
          completed: nextVal >= c.target,
        };
      }
      if (c.id === 'ch-3' && analytics.score > c.current) {
        updatedCh = true;
        return {
          ...c,
          current: analytics.score,
          completed: analytics.score >= c.target,
        };
      }
      return c;
    });
    if (updatedCh) saveDailyChallenges(newChallenges);

    // Update User Profile statistics
    const gainedXp = Math.round(analytics.score / 10);
    const nextXp = profile.xp + gainedXp;
    const nextLevel = Math.floor(nextXp / 1000) + 1;
    const nextHigh = Math.max(profile.highScore, analytics.score);
    const nextCombo = Math.max(profile.bestCombo, analytics.maxCombo);

    handleUpdateProfile({
      highScore: nextHigh,
      bestCombo: nextCombo,
      totalGames: profile.totalGames + 1,
      xp: nextXp,
      level: nextLevel,
    });

    // Cloud auto-sync backup in background
    backupToCloud({
      ...profile,
      highScore: nextHigh,
      bestCombo: nextCombo,
      totalGames: profile.totalGames + 1,
      xp: nextXp,
      level: nextLevel,
    }, analytics).catch(() => {});
  };

  // Local Duel match complete
  const handleDuelComplete = (record: LocalDuelRecord) => {
    saveLocalDuelRecord(record);

    // Update duel win/loss
    const p1Won = record.winner.includes('1') || record.winner.includes('Blue') || record.winner.includes(profile.username);
    const nextWins = p1Won ? profile.duelWins + 1 : profile.duelWins;
    const nextLosses = !p1Won ? profile.duelLosses + 1 : profile.duelLosses;

    // Challenge 2: Local duel win
    if (p1Won) {
      const challenges = getDailyChallenges();
      const newCh = challenges.map(c => {
        if (c.id === 'ch-2') {
          return { ...c, current: 1, completed: true };
        }
        return c;
      });
      saveDailyChallenges(newCh);
    }

    handleUpdateProfile({
      duelWins: nextWins,
      duelLosses: nextLosses,
      totalGames: profile.totalGames + 1,
      xp: profile.xp + 250,
    });
  };

  return (
    <div
      id="app-root"
      className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Header */}
      <Header
        profile={profile}
        onUpdateProfile={handleUpdateProfile}
        onOpenProfile={() => { setProfileOpen(true); soundEngine.playTap(); }}
        onOpenEvents={() => { setEventsOpen(true); soundEngine.playTap(); }}
        onOpenTutorial={() => { setTutorialOpen(true); soundEngine.playTap(); }}
      />

      {/* Main Content View Switcher */}
      <main className="flex-1 flex flex-col items-center justify-start w-full relative">
        {/* VIEW: MAIN MENU */}
        {view === 'menu' && (
          <div className="w-full max-w-md mx-auto p-4 flex flex-col gap-4 animate-in fade-in duration-200">
            {/* Cyber Arcade Visual Artwork Banner */}
            <div className="relative w-full h-32 rounded-3xl overflow-hidden border border-cyan-500/30 bg-gradient-to-r from-cyan-950 via-slate-900 to-rose-950 shadow-xl shadow-cyan-950/40 flex items-center justify-between px-5">
              {/* Background Animated Energy Grid & Rings */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="artGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <circle cx="88%" cy="50%" r="70" fill="none" stroke="url(#artGlow)" strokeWidth="2" strokeDasharray="6 6" />
                <circle cx="88%" cy="50%" r="45" fill="none" stroke="#06b6d4" strokeWidth="2.5" />
                <circle cx="88%" cy="50%" r="20" fill="#06b6d4" fillOpacity="0.4" />
                <path d="M 0 64 Q 150 10 300 64 T 600 64" fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.3" />
                <path d="M 0 80 Q 180 120 360 80 T 700 80" fill="none" stroke="#ec4899" strokeWidth="1.5" opacity="0.25" />
              </svg>

              <div className="relative z-10">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-[10px] font-mono font-bold text-cyan-300 w-fit mb-1.5">
                  <Zap className="w-3 h-3 text-cyan-400 fill-cyan-400 animate-pulse" /> 60 FPS ULTRA RESPONSIVE
                </div>
                <h1 className="text-2xl font-black tracking-tight text-white font-sans drop-shadow-sm leading-tight">
                  HYPER<span className="text-cyan-400">PULSE</span>
                </h1>
                <p className="text-[11px] text-slate-300 font-medium">
                  Fast-Paced Touch Duel & Reflex Rush
                </p>
              </div>

              <div className="relative z-10 flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                  <Flame className="w-7 h-7 text-cyan-300 fill-cyan-400 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Player Quick Status Hero */}
            <div className={`p-4 rounded-3xl border shadow-xl relative overflow-hidden ${
              isDark
                ? 'bg-gradient-to-br from-slate-900 via-slate-900/90 to-cyan-950/40 border-slate-800'
                : 'bg-gradient-to-br from-white via-white to-cyan-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-2xl shadow-md">
                    {profile.avatar}
                  </div>
                  <div>
                    <h2 className="font-extrabold text-base tracking-tight flex items-center gap-1.5">
                      <span>{profile.username}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 font-bold">
                        Lv.{profile.level}
                      </span>
                    </h2>
                    <span className="text-xs text-slate-400 font-mono">
                      {profile.xp} Total XP
                    </span>
                  </div>
                </div>

                <button
                  id="profile-sync-badge-btn"
                  onClick={() => { setProfileOpen(true); soundEngine.playTap(); }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-[11px] font-mono font-bold text-cyan-400 hover:bg-slate-700 transition"
                  title="Cloud Sync"
                >
                  {profile.syncCode}
                </button>
              </div>

              {/* Quick Record Ribbon */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/60 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">{t.high_score}</span>
                  <span className="text-sm font-black font-mono text-amber-400">
                    {profile.highScore.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">{t.combo_max}</span>
                  <span className="text-sm font-black font-mono text-cyan-400">
                    {profile.bestCombo || 0}x
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Duels Won</span>
                  <span className="text-sm font-black font-mono text-rose-400">
                    {profile.duelWins} W
                  </span>
                </div>
              </div>
            </div>

            {/* TWO PRIMARY TOUCH GAME MODES */}
            <div className="flex flex-col gap-3">
              {/* 1. SOLO REFLEX RUSH */}
              <button
                id="play-solo-rush-btn"
                onClick={() => {
                  soundEngine.playTap();
                  triggerHaptic('tap');
                  setView('solo');
                }}
                className="group relative w-full p-5 rounded-3xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition flex items-center justify-between overflow-hidden"
              >
                <div className="relative z-10 text-left">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap className="w-4 h-4 fill-slate-950" />
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-950">
                      High Velocity Solo
                    </span>
                  </div>
                  <h3 className="text-xl font-black tracking-tight leading-none">
                    {t.play_solo}
                  </h3>
                  <p className="text-xs font-semibold text-slate-900/80 mt-1">
                    Pulsing spheres, timing combos & power-ups
                  </p>
                </div>

                <div className="relative z-10 w-12 h-12 rounded-2xl bg-slate-950/15 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition">
                  <Play className="w-6 h-6 fill-slate-950 text-slate-950 translate-x-0.5" />
                </div>
              </button>

              {/* 2. LOCAL MULTIPLAYER SPLIT SCREEN DUEL */}
              <button
                id="play-local-duel-btn"
                onClick={() => {
                  soundEngine.playTap();
                  triggerHaptic('tap');
                  setView('duel');
                }}
                className="group relative w-full p-5 rounded-3xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white shadow-lg shadow-rose-500/20 active:scale-[0.98] transition flex items-center justify-between overflow-hidden"
              >
                <div className="relative z-10 text-left">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Swords className="w-4 h-4" />
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-amber-200">
                      Head-to-Head Split Screen
                    </span>
                  </div>
                  <h3 className="text-xl font-black tracking-tight leading-none">
                    {t.play_duel}
                  </h3>
                  <p className="text-xs font-semibold text-rose-100/90 mt-1">
                    2 players on 1 phone • Inverted split screen arena
                  </p>
                </div>

                <div className="relative z-10 w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition">
                  <Swords className="w-6 h-6 text-white" />
                </div>
              </button>
            </div>

            {/* 4 FEATURE HUB TILES */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Leaderboard */}
              <button
                id="hub-leaderboard-btn"
                onClick={() => { setView('leaderboard'); soundEngine.playTap(); }}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition active:scale-95 ${
                  isDark
                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm leading-tight">{t.leaderboard}</h4>
                  <span className="text-[10px] text-slate-400">Duels & Global Highs</span>
                </div>
              </button>

              {/* Analytics */}
              <button
                id="hub-analytics-btn"
                onClick={() => { setView('analytics'); soundEngine.playTap(); }}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition active:scale-95 ${
                  isDark
                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-2">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm leading-tight">{t.analytics}</h4>
                  <span className="text-[10px] text-slate-400">Reaction & Accuracy</span>
                </div>
              </button>

              {/* Daily Challenges */}
              <button
                id="hub-challenges-btn"
                onClick={() => { setView('challenges'); soundEngine.playTap(); }}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition active:scale-95 ${
                  isDark
                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-2">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm leading-tight">{t.challenges}</h4>
                  <span className="text-[10px] text-slate-400">Quests & Streaks</span>
                </div>
              </button>

              {/* Tutorial */}
              <button
                id="hub-tutorial-btn"
                onClick={() => { setTutorialOpen(true); soundEngine.playTap(); }}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition active:scale-95 ${
                  isDark
                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm leading-tight">{t.tutorial}</h4>
                  <span className="text-[10px] text-slate-400">Guide & Strategies</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* VIEW: SOLO GAME */}
        {view === 'solo' && (
          <SoloGame
            profile={profile}
            onGameOver={handleSoloGameOver}
            onBackToMenu={() => setView('menu')}
          />
        )}

        {/* VIEW: LOCAL DUEL GAME */}
        {view === 'duel' && (
          <LocalDuelGame
            profile={profile}
            onMatchComplete={handleDuelComplete}
            onBackToMenu={() => setView('menu')}
          />
        )}

        {/* VIEW: LEADERBOARD */}
        {view === 'leaderboard' && (
          <LeaderboardView
            profile={profile}
            onBack={() => setView('menu')}
          />
        )}

        {/* VIEW: ANALYTICS */}
        {view === 'analytics' && (
          <AnalyticsView
            profile={profile}
            onBack={() => setView('menu')}
          />
        )}

        {/* VIEW: CHALLENGES */}
        {view === 'challenges' && (
          <ChallengesView
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            onBack={() => setView('menu')}
          />
        )}
      </main>

      {/* Persistent Modals */}
      <TutorialModal
        profile={profile}
        isOpen={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
      />

      <ProfileModal
        profile={profile}
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onUpdateProfile={handleUpdateProfile}
      />

      <EventsModal
        profile={profile}
        isOpen={eventsOpen}
        onClose={() => setEventsOpen(false)}
      />

      {/* Offline Status Toast Indicator */}
      <OfflineIndicator />
    </div>
  );
}
