import React, { useState, useEffect } from 'react';
import { Activity, ArrowLeft, Zap, Target, Flame, Swords, CheckCircle2, TrendingUp } from 'lucide-react';
import { UserProfile, MatchAnalytics } from '../types';
import { translations } from '../i18n/translations';
import { getMatchAnalytics } from '../services/storage';
import { RecentMatchReplay } from './RecentMatchReplay';

interface AnalyticsViewProps {
  profile: UserProfile;
  onBack: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  profile,
  onBack,
}) => {
  const t = translations[profile.language] || translations.en;
  const isDark = profile.theme === 'dark';

  const [history, setHistory] = useState<MatchAnalytics[]>([]);

  useEffect(() => {
    setHistory(getMatchAnalytics());
  }, []);

  // Compute metrics
  const totalMatches = history.length;
  const avgReaction = totalMatches > 0
    ? Math.round(history.reduce((sum, h) => sum + (h.avgReactionTimeMs || 220), 0) / totalMatches)
    : 220;

  const avgAccuracy = totalMatches > 0
    ? Math.round((history.reduce((sum, h) => sum + (h.accuracy || 90), 0) / totalMatches) * 10) / 10
    : 94.2;

  const totalPerfect = history.reduce((sum, h) => sum + (h.perfectHits || 0), 0);
  const totalGreat = history.reduce((sum, h) => sum + (h.greatHits || 0), 0);
  const totalMisses = history.reduce((sum, h) => sum + (h.misses || 0), 0);
  const allHits = Math.max(1, totalPerfect + totalGreat + totalMisses);

  const perfectPct = Math.round((totalPerfect / allHits) * 100);
  const greatPct = Math.round((totalGreat / allHits) * 100);
  const missPct = Math.max(0, 100 - perfectPct - greatPct);

  // Reaction rating tier
  const reactionTier = avgReaction < 200
    ? { title: "⚡ Apex Reflex (Godlike)", color: "text-amber-400" }
    : avgReaction < 250
    ? { title: "🚀 Lightning Fast", color: "text-cyan-400" }
    : avgReaction < 300
    ? { title: "🎯 Swift Reaction", color: "text-emerald-400" }
    : { title: "⏱️ Moderate Reflex", color: "text-slate-300" };

  // Score progression SVG path
  const recentScores = history.slice(0, 7).map(h => h.score).reverse();
  const maxScore = Math.max(...recentScores, 10000);
  const minScore = Math.min(...recentScores, 0);
  const chartHeight = 80;
  const chartWidth = 300;

  const points = recentScores.map((score, i) => {
    const x = recentScores.length > 1 ? (i / (recentScores.length - 1)) * (chartWidth - 20) + 10 : chartWidth / 2;
    const y = chartHeight - ((score - minScore) / (maxScore - minScore || 1)) * (chartHeight - 20) - 10;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div
      id="analytics-dashboard"
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
          <Activity className="w-5 h-5 text-cyan-400" /> {t.analytics}
        </h2>
        <div className="w-9" />
      </div>

      <div className="space-y-3.5 flex-1 overflow-y-auto pb-6">
        {/* Most Recent Match Summary Replay */}
        <RecentMatchReplay matches={history} profile={profile} />

        {/* Reaction Time Hero Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-cyan-400" /> {t.avg_reaction}
            </span>
            <span className={`text-xs font-bold ${reactionTier.color}`}>
              {reactionTier.title}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black font-mono text-cyan-400">
              {avgReaction}
            </span>
            <span className="text-sm font-bold text-slate-400 font-mono">ms</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Measured across all precision pulse taps. Sub-250ms places you in the top 10% worldwide!
          </p>
        </div>

        {/* 4 Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-emerald-400" /> {t.accuracy}
            </span>
            <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
              {avgAccuracy}%
            </div>
            <span className="text-[10px] text-slate-500">Global Average: 91%</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" /> {t.combo_max}
            </span>
            <div className="text-2xl font-black font-mono text-amber-400 mt-1">
              {profile.bestCombo || 24}x
            </div>
            <span className="text-[10px] text-slate-500">Personal Peak Record</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
              <Swords className="w-3.5 h-3.5 text-rose-400" /> {t.win_rate}
            </span>
            <div className="text-2xl font-black font-mono text-rose-400 mt-1">
              {profile.duelWins + profile.duelLosses > 0 
                ? Math.round((profile.duelWins / (profile.duelWins + profile.duelLosses)) * 100) 
                : 75}%
            </div>
            <span className="text-[10px] text-slate-500">{profile.duelWins}W - {profile.duelLosses}L</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" /> Total Matches
            </span>
            <div className="text-2xl font-black font-mono text-purple-400 mt-1">
              {profile.totalGames || totalMatches}
            </div>
            <span className="text-[10px] text-slate-500">Recorded Sessions</span>
          </div>
        </div>

        {/* Tap Accuracy Quality Distribution */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Hit Quality Distribution</span>
            <span className="text-cyan-400 font-mono text-[10px]">{allHits} Total Taps</span>
          </h4>

          {/* Tri-color progress bar */}
          <div className="h-3 rounded-full bg-slate-800 overflow-hidden flex gap-0.5 mb-3">
            <div style={{ width: `${perfectPct}%` }} className="bg-emerald-400 h-full transition-all duration-500" />
            <div style={{ width: `${greatPct}%` }} className="bg-cyan-400 h-full transition-all duration-500" />
            <div style={{ width: `${missPct}%` }} className="bg-rose-500 h-full transition-all duration-500" />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] font-bold text-emerald-400 block">PERFECT</span>
              <span className="font-mono font-black text-emerald-300">{perfectPct}%</span>
            </div>
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <span className="text-[10px] font-bold text-cyan-400 block">GREAT</span>
              <span className="font-mono font-black text-cyan-300">{greatPct}%</span>
            </div>
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <span className="text-[10px] font-bold text-rose-400 block">MISS</span>
              <span className="font-mono font-black text-rose-300">{missPct}%</span>
            </div>
          </div>
        </div>

        {/* Score Progression Trend Chart */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-cyan-400" /> Score Progression
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">Last 7 Games</span>
          </div>

          {recentScores.length > 1 ? (
            <div className="w-full flex flex-col items-center mt-3">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-24 overflow-visible">
                <polyline
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={points}
                />
                {recentScores.map((sc, i) => {
                  const x = recentScores.length > 1 ? (i / (recentScores.length - 1)) * (chartWidth - 20) + 10 : chartWidth / 2;
                  const y = chartHeight - ((sc - minScore) / (maxScore - minScore || 1)) * (chartHeight - 20) - 10;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#38bdf8"
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                  );
                })}
              </svg>
              <div className="flex items-center justify-between w-full text-[10px] text-slate-500 font-mono mt-2">
                <span>Earliest</span>
                <span className="text-cyan-400 font-bold">Peak: {Math.max(...recentScores).toLocaleString()}</span>
                <span>Latest</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-500">
              Play a few matches to view score trends!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
