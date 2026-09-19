import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Swords, RotateCcw, ArrowLeft, Trophy, Zap, Shield, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, LocalDuelRecord } from '../types';
import { translations } from '../i18n/translations';
import { soundEngine, triggerHaptic } from '../services/audio';

interface LocalDuelGameProps {
  profile: UserProfile;
  onMatchComplete: (record: LocalDuelRecord) => void;
  onBackToMenu: () => void;
}

interface DuelTarget {
  id: number;
  player: 1 | 2;
  x: number; // percentage in player zone
  y: number;
  duration: number;
  spawnTime: number;
  color: string;
  points: number;
  type: 'standard' | 'golden' | 'sabotage';
}

export const LocalDuelGame: React.FC<LocalDuelGameProps> = ({
  profile,
  onMatchComplete,
  onBackToMenu,
}) => {
  const t = translations[profile.language] || translations.en;
  const isDark = profile.theme === 'dark';

  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'ended'>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(45);

  // Scores
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [p1Combo, setP1Combo] = useState(0);
  const [p2Combo, setP2Combo] = useState(0);

  // Sabotage states (smoke/glitch on opponent's half)
  const [p1Sabotaged, setP1Sabotaged] = useState(false);
  const [p2Sabotaged, setP2Sabotaged] = useState(false);

  // Targets
  const [targets, setTargets] = useState<DuelTarget[]>([]);
  const targetCounter = useRef(1);

  // Countdown
  useEffect(() => {
    if (gameState === 'countdown') {
      if (countdown > 0) {
        soundEngine.playTap();
        const timer = setTimeout(() => setCountdown(countdown - 1), 800);
        return () => clearTimeout(timer);
      } else {
        setGameState('playing');
        soundEngine.playPowerUp();
      }
    }
  }, [countdown, gameState]);

  // Match timer (45 seconds)
  useEffect(() => {
    if (gameState !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          endMatch();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, p1Score, p2Score]);

  // Spawner for both players
  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      setTargets(cur => {
        // Keep max 3 targets per player
        const p1Targets = cur.filter(t => t.player === 1);
        const p2Targets = cur.filter(t => t.player === 2);
        const newTargets = [...cur];

        if (p1Targets.length < 3) {
          const rand = Math.random();
          const type: DuelTarget['type'] = rand < 0.15 ? 'sabotage' : rand < 0.3 ? 'golden' : 'standard';
          newTargets.push({
            id: targetCounter.current++,
            player: 1,
            x: Math.floor(15 + Math.random() * 70),
            y: Math.floor(20 + Math.random() * 60),
            duration: 1600,
            spawnTime: Date.now(),
            color: type === 'sabotage' ? '#ec4899' : type === 'golden' ? '#f59e0b' : '#38bdf8',
            points: type === 'golden' ? 250 : 100,
            type,
          });
        }

        if (p2Targets.length < 3) {
          const rand = Math.random();
          const type: DuelTarget['type'] = rand < 0.15 ? 'sabotage' : rand < 0.3 ? 'golden' : 'standard';
          newTargets.push({
            id: targetCounter.current++,
            player: 2,
            x: Math.floor(15 + Math.random() * 70),
            y: Math.floor(20 + Math.random() * 60),
            duration: 1600,
            spawnTime: Date.now(),
            color: type === 'sabotage' ? '#ec4899' : type === 'golden' ? '#f59e0b' : '#f43f5e',
            points: type === 'golden' ? 250 : 100,
            type,
          });
        }

        return newTargets;
      });
    }, 650);

    return () => clearInterval(interval);
  }, [gameState]);

  // Expiration
  useEffect(() => {
    if (gameState !== 'playing') return;

    const cleaner = setInterval(() => {
      const now = Date.now();
      setTargets(cur => cur.filter(t => now - t.spawnTime <= t.duration));
    }, 120);

    return () => clearInterval(cleaner);
  }, [gameState]);

  // Target Tap Handler
  const handleTap = (target: DuelTarget, e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation?.();
    }
    if (gameState !== 'playing') return;

    // Remove target immediately
    setTargets(cur => cur.filter(t => t.id !== target.id));

    const isP1 = target.player === 1;
    soundEngine.playTap('PERFECT', isP1 ? p1Combo + 1 : p2Combo + 1);
    triggerHaptic('tap');

    // Sabotage activates opponent glitch
    if (target.type === 'sabotage') {
      soundEngine.playPowerUp();
      if (isP1) {
        setP2Sabotaged(true);
        setTimeout(() => setP2Sabotaged(false), 2500);
      } else {
        setP1Sabotaged(true);
        setTimeout(() => setP1Sabotaged(false), 2500);
      }
    }

    if (isP1) {
      setP1Combo(c => c + 1);
      const mult = 1 + Math.floor(p1Combo / 6);
      setP1Score(s => {
        const next = s + target.points * mult;
        if (next >= 1200) setTimeout(() => endMatch(), 50);
        return next;
      });
    } else {
      setP2Combo(c => c + 1);
      const mult = 1 + Math.floor(p2Combo / 6);
      setP2Score(s => {
        const next = s + target.points * mult;
        if (next >= 1200) setTimeout(() => endMatch(), 50);
        return next;
      });
    }
  };

  const endMatch = () => {
    setGameState('ended');
    soundEngine.playVictory();
    triggerHaptic('success');
    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.5 }
    });

    const winner = p1Score > p2Score 
      ? t.player1 
      : p2Score > p1Score 
      ? t.player2 
      : t.draw;

    const record: LocalDuelRecord = {
      id: `duel_${Date.now()}`,
      player1: `${profile.username} (Blue)`,
      player2: `Challenger (Coral)`,
      score1: p1Score,
      score2: p2Score,
      winner,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    onMatchComplete(record);
  };

  const totalPoints = Math.max(1, p1Score + p2Score);
  const p1Ratio = Math.round((p1Score / totalPoints) * 100);

  return (
    <div
      id="local-duel-container"
      className="relative w-full h-[calc(100vh-62px)] max-w-md mx-auto flex flex-col select-none overflow-hidden bg-slate-950 text-slate-100"
    >
      {/* PLAYER 2 ZONE (TOP HALF - INVERTED 180 DEG FOR OPPONENT) */}
      <div
        id="duel-p2-zone"
        className={`relative flex-1 w-full border-b-2 border-slate-700/80 rotate-180 overflow-hidden touch-none transition-colors duration-300 ${
          p2Sabotaged ? 'bg-fuchsia-950/40 animate-pulse' : 'bg-slate-900/60'
        }`}
      >
        {/* Opponent HUD */}
        <div className="absolute top-2 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-rose-500/20 px-2.5 py-1 rounded-xl border border-rose-500/40">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="text-xs font-bold text-rose-300">{t.player2}</span>
          </div>
          <div className="text-right">
            <span className="text-xl font-black font-mono text-rose-400">{p2Score}</span>
            {p2Combo > 2 && (
              <span className="text-[10px] block font-bold text-amber-400 font-mono">
                {p2Combo}x COMBO
              </span>
            )}
          </div>
        </div>

        {p2Sabotaged && (
          <div className="absolute inset-0 bg-fuchsia-900/30 backdrop-blur-[2px] flex items-center justify-center z-15 pointer-events-none">
            <span className="px-3 py-1 rounded-full bg-fuchsia-600 text-slate-950 font-black text-xs tracking-wider animate-bounce">
              ⚡ SABOTAGED! ⚡
            </span>
          </div>
        )}

        {/* Player 2 Targets */}
        {targets.filter(t => t.player === 2).map(target => (
          <div
            key={target.id}
            id={`p2-target-${target.id}`}
            style={{
              left: `${target.x}%`,
              top: `${target.y}%`,
            }}
            onPointerDown={(e) => handleTap(target, e)}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-20 h-20 flex items-center justify-center cursor-pointer select-none touch-none active:scale-95 transition-transform"
          >
            {/* GPU Collapsing ring */}
            <div
              style={{
                animationDuration: `${target.duration}ms`,
                borderColor: target.color,
                boxShadow: `0 0 10px ${target.color}88`,
              }}
              className="absolute inset-0 rounded-full border-2 anim-collapse-ring pointer-events-none"
            />
            {/* Inner pulsing boundary */}
            <div
              style={{
                animationDuration: '6s',
                borderColor: `${target.color}66`,
              }}
              className="absolute inset-1.5 rounded-full border border-dashed opacity-70 animate-spin pointer-events-none"
            />
            <div
              style={{
                backgroundColor: target.type === 'sabotage' ? '#ec4899' : target.type === 'golden' ? '#f59e0b' : '#f43f5e',
                boxShadow: `0 0 16px ${target.color}`,
              }}
              className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-slate-950 text-xs shadow-lg pointer-events-none"
            >
              {target.type === 'sabotage' ? (
                <Zap className="w-4 h-4 text-white fill-white animate-bounce" />
              ) : target.type === 'golden' ? (
                <Flame className="w-4 h-4 text-slate-950 fill-slate-950" />
              ) : (
                <span className="text-white font-mono font-extrabold text-xs">PULSE</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MIDLINE TUG-OF-WAR ARENA DIVIDER */}
      <div className="relative h-10 w-full bg-slate-900 border-y border-slate-700/80 flex items-center justify-between px-4 z-20 shadow-md">
        {/* P1 Score Bar Ratio */}
        <div className="absolute inset-0 flex pointer-events-none opacity-20">
          <div style={{ width: `${p1Ratio}%` }} className="h-full bg-cyan-500 transition-all duration-300" />
          <div style={{ width: `${100 - p1Ratio}%` }} className="h-full bg-rose-500 transition-all duration-300" />
        </div>

        <div className="flex items-center gap-1.5 z-10">
          <Swords className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-bold text-cyan-400">{p1Score}</span>
        </div>

        {/* Center Countdown / Timer */}
        <div className="z-10 flex items-center gap-2 bg-slate-950/80 px-2.5 py-0.5 rounded-full border border-slate-700">
          <span className="text-xs font-mono font-black text-amber-400">
            ⏱️ {timeLeft}s
          </span>
        </div>

        <div className="flex items-center gap-1.5 z-10">
          <span className="text-xs font-mono font-bold text-rose-400">{p2Score}</span>
          <Swords className="w-4 h-4 text-rose-400" />
        </div>
      </div>

      {/* PLAYER 1 ZONE (BOTTOM HALF - STANDARD ORIENTATION) */}
      <div
        id="duel-p1-zone"
        className={`relative flex-1 w-full overflow-hidden touch-none transition-colors duration-300 ${
          p1Sabotaged ? 'bg-fuchsia-950/40 animate-pulse' : 'bg-slate-900/60'
        }`}
      >
        {/* P1 HUD */}
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-cyan-500/20 px-2.5 py-1 rounded-xl border border-cyan-500/40">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
            <span className="text-xs font-bold text-cyan-300">{t.player1}</span>
          </div>
          <div className="text-right">
            <span className="text-xl font-black font-mono text-cyan-400">{p1Score}</span>
            {p1Combo > 2 && (
              <span className="text-[10px] block font-bold text-amber-400 font-mono">
                {p1Combo}x COMBO
              </span>
            )}
          </div>
        </div>

        {p1Sabotaged && (
          <div className="absolute inset-0 bg-fuchsia-900/30 backdrop-blur-[2px] flex items-center justify-center z-15 pointer-events-none">
            <span className="px-3 py-1 rounded-full bg-fuchsia-600 text-slate-950 font-black text-xs tracking-wider animate-bounce">
              ⚡ SABOTAGED! ⚡
            </span>
          </div>
        )}

        {/* Player 1 Targets */}
        {targets.filter(t => t.player === 1).map(target => (
          <div
            key={target.id}
            id={`p1-target-${target.id}`}
            style={{
              left: `${target.x}%`,
              top: `${target.y}%`,
            }}
            onPointerDown={(e) => handleTap(target, e)}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-20 h-20 flex items-center justify-center cursor-pointer select-none touch-none active:scale-95 transition-transform"
          >
            {/* GPU Collapsing ring */}
            <div
              style={{
                animationDuration: `${target.duration}ms`,
                borderColor: target.color,
                boxShadow: `0 0 10px ${target.color}88`,
              }}
              className="absolute inset-0 rounded-full border-2 anim-collapse-ring pointer-events-none"
            />
            {/* Inner pulsing boundary */}
            <div
              style={{
                animationDuration: '6s',
                borderColor: `${target.color}66`,
              }}
              className="absolute inset-1.5 rounded-full border border-dashed opacity-70 animate-spin pointer-events-none"
            />
            <div
              style={{
                backgroundColor: target.type === 'sabotage' ? '#ec4899' : target.type === 'golden' ? '#f59e0b' : '#0284c7',
                boxShadow: `0 0 16px ${target.color}`,
              }}
              className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-slate-950 text-xs shadow-lg pointer-events-none"
            >
              {target.type === 'sabotage' ? (
                <Zap className="w-4 h-4 text-white fill-white animate-bounce" />
              ) : target.type === 'golden' ? (
                <Flame className="w-4 h-4 text-slate-950 fill-slate-950" />
              ) : (
                <span className="text-white font-mono font-extrabold text-xs">PULSE</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Countdown Overlay */}
      {gameState === 'countdown' && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center z-40 p-6 text-center">
          <p className="text-sm font-bold text-cyan-400 mb-2 uppercase tracking-wider">
            {t.play_duel}
          </p>
          <div className="text-7xl font-black text-amber-400 font-mono animate-bounce my-3">
            {countdown > 0 ? countdown : 'FIGHT!'}
          </div>
          <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
            {t.first_to_points}
          </p>
        </div>
      )}

      {/* Match Result Overlay */}
      {gameState === 'ended' && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-40 p-5">
          <div className="w-full max-w-xs rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Trophy className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-black mb-1">
              {p1Score > p2Score ? t.p1_wins : p2Score > p1Score ? t.p2_wins : t.draw}
            </h3>

            {/* Match Final Scores */}
            <div className="flex items-center justify-around my-5 py-3 px-4 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="text-center">
                <span className="text-[10px] font-bold text-cyan-400 block uppercase">P1 (Blue)</span>
                <span className="text-2xl font-black font-mono text-cyan-300">{p1Score}</span>
              </div>
              <div className="text-slate-500 font-black text-sm">VS</div>
              <div className="text-center">
                <span className="text-[10px] font-bold text-rose-400 block uppercase">P2 (Coral)</span>
                <span className="text-2xl font-black font-mono text-rose-300">{p2Score}</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                id="duel-rematch-btn"
                onClick={() => {
                  setP1Score(0);
                  setP2Score(0);
                  setP1Combo(0);
                  setP2Combo(0);
                  setTimeLeft(45);
                  setCountdown(3);
                  setGameState('countdown');
                }}
                className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-400 active:scale-95 transition"
              >
                <RotateCcw className="w-4 h-4" /> {t.rematch}
              </button>
              <button
                id="duel-exit-btn"
                onClick={onBackToMenu}
                className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700 transition"
              >
                {t.back_to_menu}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
