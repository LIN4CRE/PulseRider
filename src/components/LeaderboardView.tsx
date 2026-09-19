import React, { useState, useEffect } from 'react';
import { Trophy, Swords, Globe, Users, Award, Shield, ArrowLeft, RefreshCw } from 'lucide-react';
import { UserProfile, LocalDuelRecord, GlobalLeaderboardItem } from '../types';
import { translations } from '../i18n/translations';
import { getLocalDuelRecords } from '../services/storage';
import { soundEngine } from '../services/audio';

interface LeaderboardViewProps {
  profile: UserProfile;
  onBack: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  profile,
  onBack,
}) => {
  const t = translations[profile.language] || translations.en;
  const isDark = profile.theme === 'dark';

  const [tab, setTab] = useState<'local' | 'global' | 'social'>('local');
  const [localRecords, setLocalRecords] = useState<LocalDuelRecord[]>([]);
  const [globalList, setGlobalList] = useState<GlobalLeaderboardItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocalRecords(getLocalDuelRecords());
    fetchGlobalLeaderboard();
  }, []);

  const fetchGlobalLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        if (data.global) setGlobalList(data.global);
        if (data.localDuel && data.localDuel.length > 0) {
          // Merge local server duel records
          const merged = [...data.localDuel, ...getLocalDuelRecords()];
          // Unique by ID
          const unique = Array.from(new Map(merged.map(m => [m.id, m])).values());
          setLocalRecords(unique as any);
        }
      }
    } catch (e) {}
    setLoading(false);
  };

  // Local Duel stats calculation
  const totalDuels = localRecords.length;
  const p1Wins = localRecords.filter(r => r.winner.includes('1') || r.winner.includes('Blue') || r.winner.includes(profile.username)).length;
  const p2Wins = totalDuels - p1Wins;

  return (
    <div
      id="leaderboard-view"
      className={`w-full max-w-md mx-auto min-h-[calc(100vh-62px)] flex flex-col p-4 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className={`p-2 rounded-xl transition ${isDark ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-700 shadow-sm'}`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" /> {t.leaderboard}
        </h2>
        <button
          onClick={fetchGlobalLeaderboard}
          className={`p-2 rounded-xl transition ${isDark ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-700 shadow-sm'}`}
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* Segmented Control Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-slate-800 mb-4">
        <button
          onClick={() => { setTab('local'); soundEngine.playTap(); }}
          className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
            tab === 'local' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Swords className="w-3.5 h-3.5" />
          <span>{t.local_duel_tab}</span>
        </button>
        <button
          onClick={() => { setTab('global'); soundEngine.playTap(); }}
          className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
            tab === 'global' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{t.global_tab}</span>
        </button>
        <button
          onClick={() => { setTab('social'); soundEngine.playTap(); }}
          className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
            tab === 'social' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{t.social_tab}</span>
        </button>
      </div>

      {/* TAB 1: LOCAL MULTIPLAYER DUELS */}
      {tab === 'local' && (
        <div className="flex-1 flex flex-col gap-3">
          {/* Head-to-Head Win Counter Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-rose-950/40 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
              <span className="text-cyan-400">P1 (Blue) Wins: {p1Wins}</span>
              <span className="text-rose-400">P2 (Coral) Wins: {p2Wins}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden flex">
              <div
                style={{ width: `${totalDuels > 0 ? (p1Wins / totalDuels) * 100 : 50}%` }}
                className="h-full bg-cyan-500 transition-all duration-300"
              />
              <div
                style={{ width: `${totalDuels > 0 ? (p2Wins / totalDuels) * 100 : 50}%` }}
                className="h-full bg-rose-500 transition-all duration-300"
              />
            </div>
            <div className="mt-2 text-center text-[11px] text-slate-400">
              Total Competitive Duels: <strong className="text-white">{totalDuels}</strong>
            </div>
          </div>

          {/* Match Records List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {localRecords.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No local duel matches played yet.<br />Challenge a friend to head-to-head duel!
              </div>
            ) : (
              localRecords.map((match, idx) => (
                <div
                  key={match.id || idx}
                  className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="font-bold text-slate-200">
                        {match.winner}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {match.score1} pts vs {match.score2} pts
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {match.date}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GLOBAL HIGH SCORES */}
      {tab === 'global' && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {globalList.map((entry, idx) => {
            const isUser = entry.username.toLowerCase() === profile.username.toLowerCase();
            return (
              <div
                key={entry.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 text-xs transition ${
                  isUser
                    ? 'bg-cyan-500/15 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                    : 'bg-slate-900/70 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                    idx === 0 ? 'bg-amber-400 text-slate-950' :
                    idx === 1 ? 'bg-slate-300 text-slate-950' :
                    idx === 2 ? 'bg-amber-700 text-white' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className="text-base">{entry.avatar}</span>
                  <div>
                    <div className="font-bold flex items-center gap-1.5">
                      <span>{entry.username}</span>
                      {isUser && (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-400 text-slate-950 text-[9px] font-black">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {entry.rank} • {entry.region}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-extrabold font-mono text-cyan-400 text-sm block">
                    {entry.score.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {entry.maxCombo}x combo
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: SOCIAL RIVALS */}
      {tab === 'social' && (
        <div className="flex-1 overflow-y-auto space-y-2">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 mb-2">
            Weekly Friend League resets in <strong className="text-cyan-400">2d 14h</strong>.
          </div>
          {[
            { name: "Alex_Blade", avatar: "⚡", score: 42100, combo: 44, rank: 1 },
            { name: profile.username, avatar: profile.avatar, score: profile.highScore || 24800, combo: profile.bestCombo || 22, rank: 2, isMe: true },
            { name: "JordanK", avatar: "🎯", score: 21900, combo: 19, rank: 3 },
            { name: "Sarah_Tap", avatar: "🌸", score: 18400, combo: 17, rank: 4 },
            { name: "DaveZero", avatar: "🚀", score: 14200, combo: 12, rank: 5 },
          ].map((friend) => (
            <div
              key={friend.name}
              className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                friend.isMe
                  ? 'bg-cyan-500/15 border-cyan-500/50'
                  : 'bg-slate-900/70 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 font-mono font-bold text-slate-400">#{friend.rank}</span>
                <span className="text-base">{friend.avatar}</span>
                <div>
                  <div className="font-bold flex items-center gap-1">
                    <span>{friend.name}</span>
                    {friend.isMe && <span className="text-[9px] bg-cyan-400 text-slate-950 font-bold px-1 rounded">YOU</span>}
                  </div>
                  <div className="text-[10px] text-slate-400">{friend.combo}x best combo</div>
                </div>
              </div>
              <span className="font-mono font-bold text-amber-400 text-sm">
                {friend.score.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
