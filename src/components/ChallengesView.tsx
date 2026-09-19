import React, { useState, useEffect } from 'react';
import { Target, Gift, CheckCircle, Calendar, ArrowLeft, Zap, Sparkles, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, DailyChallenge } from '../types';
import { translations } from '../i18n/translations';
import { getDailyChallenges, saveDailyChallenges, getLoginStreak } from '../services/storage';
import { soundEngine, triggerHaptic } from '../services/audio';

interface ChallengesViewProps {
  profile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onBack: () => void;
}

export const ChallengesView: React.FC<ChallengesViewProps> = ({
  profile,
  onUpdateProfile,
  onBack,
}) => {
  const t = translations[profile.language] || translations.en;
  const isDark = profile.theme === 'dark';

  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [streak, setStreak] = useState(3);
  const [streakClaimed, setStreakClaimed] = useState(false);

  useEffect(() => {
    setChallenges(getDailyChallenges());
    setStreak(getLoginStreak());
  }, []);

  const handleClaimChallenge = (id: string) => {
    const target = challenges.find(c => c.id === id);
    if (!target || target.claimed || !target.completed) return;

    soundEngine.playPowerUp();
    triggerHaptic('success');
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });

    const nextChallenges = challenges.map(c => c.id === id ? { ...c, claimed: true } : c);
    setChallenges(nextChallenges);
    saveDailyChallenges(nextChallenges);

    // Grant XP
    const newXp = profile.xp + target.rewardXp;
    const newLevel = Math.floor(newXp / 1000) + 1;
    onUpdateProfile({ xp: newXp, level: newLevel });
  };

  const handleClaimStreak = () => {
    if (streakClaimed) return;
    setStreakClaimed(true);
    soundEngine.playVictory();
    triggerHaptic('success');
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 } });

    const newXp = profile.xp + 400;
    const newLevel = Math.floor(newXp / 1000) + 1;
    onUpdateProfile({ xp: newXp, level: newLevel });
  };

  const streakDays = [
    { day: 1, xp: 100, label: "Day 1" },
    { day: 2, xp: 150, label: "Day 2" },
    { day: 3, xp: 250, label: "Day 3" },
    { day: 4, xp: 350, label: "Day 4" },
    { day: 5, xp: 500, label: "Day 5" },
    { day: 6, xp: 750, label: "Day 6" },
    { day: 7, xp: 1500, label: "Day 7 🔥" },
  ];

  return (
    <div
      id="challenges-view"
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
          <Gift className="w-5 h-5 text-amber-400" /> {t.challenges}
        </h2>
        <div className="w-9" />
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pb-6">
        {/* 7-Day Login Streak Box */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {t.daily_streak}: <strong className="text-amber-400 font-mono">{streak} Days</strong>
              </span>
            </div>
            <button
              onClick={handleClaimStreak}
              disabled={streakClaimed}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                streakClaimed
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-md active:scale-95'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{streakClaimed ? t.claimed : t.claim_reward}</span>
            </button>
          </div>

          {/* 7-Day row */}
          <div className="grid grid-cols-7 gap-1">
            {streakDays.map(item => {
              const isPast = item.day <= streak;
              const isToday = item.day === streak;

              return (
                <div
                  key={item.day}
                  className={`p-1.5 rounded-xl flex flex-col items-center justify-center border text-center transition ${
                    isToday
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : isPast
                      ? 'bg-slate-800/80 border-slate-700 text-slate-400'
                      : 'bg-slate-900/40 border-slate-800/50 text-slate-600'
                  }`}
                >
                  <span className="text-[9px] font-bold block">{item.label}</span>
                  <span className="text-[10px] font-mono font-bold mt-1">+{item.xp}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Challenges List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-cyan-400" /> Active Daily Quests
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Resets in 13h 40m</span>
          </div>

          {challenges.map(ch => {
            const title = t[ch.titleKey] || ch.titleKey;
            const desc = t[ch.descKey] || ch.descKey;
            const pct = Math.min(100, Math.round((ch.current / ch.target) * 100));

            return (
              <div
                key={ch.id}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                      <span>{title}</span>
                      <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-mono">
                        +{ch.rewardXp} XP
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                  </div>

                  <button
                    onClick={() => handleClaimChallenge(ch.id)}
                    disabled={!ch.completed || ch.claimed}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${
                      ch.claimed
                        ? 'bg-slate-800 text-slate-500'
                        : ch.completed
                        ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-md animate-bounce'
                        : 'bg-slate-800/80 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {ch.claimed ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> {t.claimed}
                      </>
                    ) : ch.completed ? (
                      <>
                        <Gift className="w-3.5 h-3.5" /> {t.claim_reward}
                      </>
                    ) : (
                      <span>{ch.current} / {ch.target}</span>
                    )}
                  </button>
                </div>

                {/* Quest Progress Bar */}
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mt-3">
                  <div
                    style={{ width: `${pct}%` }}
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
