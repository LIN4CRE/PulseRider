import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Swords, RotateCcw, ArrowLeft, Trophy, Zap, Shield, Flame, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, LocalDuelRecord, MatchAnalytics, ReplayEvent } from '../types';
import { translations } from '../i18n/translations';
import { soundEngine, triggerHaptic } from '../services/audio';
import { TargetGlyph } from './TargetGlyph';

interface LocalDuelGameProps {
  profile: UserProfile;
  onMatchComplete: (record: LocalDuelRecord, analytics?: MatchAnalytics) => void;
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
  type: 'standard' | 'golden' | 'sabotage' | 'multi' | 'vortex';
  hitsRemaining?: number;
  maxHits?: number;
}

interface Shockwave {
  id: number;
  player: 1 | 2;
  x: number;
  y: number;
  color: string;
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
  const [speedMode, setSpeedMode] = useState<'turbo' | 'overdrive' | 'standard'>('turbo');

  // Sabotage states (smoke/glitch on opponent's half)
  const [p1Sabotaged, setP1Sabotaged] = useState(false);
  const [p2Sabotaged, setP2Sabotaged] = useState(false);

  // Targets & Shockwaves
  const [targets, setTargets] = useState<DuelTarget[]>([]);
  const [shockwaves, setShockwaves] = useState<Shockwave[]>([]);
  const targetCounter = useRef(1);

  // Replay and performance tracking
  const matchStartTimeRef = useRef(Date.now());
  const replayEventsRef = useRef<ReplayEvent[]>([]);
  const p1ReactionTimesRef = useRef<number[]>([]);
  const p2ReactionTimesRef = useRef<number[]>([]);
  const p1HitsRef = useRef(0);
  const p2HitsRef = useRef(0);
  const p1MissesRef = useRef(0);
  const p2MissesRef = useRef(0);
  const p1MaxComboRef = useRef(0);
  const p2MaxComboRef = useRef(0);

  // Countdown
  useEffect(() => {
    if (gameState === 'countdown') {
      if (countdown > 0) {
        soundEngine.playTap();
        const timer = setTimeout(() => setCountdown(countdown - 1), 800);
        return () => clearTimeout(timer);
      } else {
        matchStartTimeRef.current = Date.now();
        replayEventsRef.current = [];
        p1ReactionTimesRef.current = [];
        p2ReactionTimesRef.current = [];
        p1HitsRef.current = 0;
        p2HitsRef.current = 0;
        p1MissesRef.current = 0;
        p2MissesRef.current = 0;
        p1MaxComboRef.current = 0;
        p2MaxComboRef.current = 0;
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

  // Spawner for both players with fast-paced reflex scaling
  useEffect(() => {
    if (gameState !== 'playing') return;

    let intervalTime = 350;
    let maxTargetsPerPlayer = 4;
    let baseDuration = Math.max(720, 1000 - Math.min((p1Score + p2Score) / 4, 280));
    let sabotageChance = 0.18;
    let goldenChance = 0.35;

    if (speedMode === 'overdrive') {
      intervalTime = 230;
      maxTargetsPerPlayer = 5;
      baseDuration = Math.max(480, 720 - Math.min((p1Score + p2Score) / 4, 240));
      sabotageChance = 0.22;
      goldenChance = 0.40;
    } else if (speedMode === 'standard') {
      intervalTime = 550;
      maxTargetsPerPlayer = 3;
      baseDuration = 1400;
      sabotageChance = 0.15;
      goldenChance = 0.30;
    }

    const interval = setInterval(() => {
      setTargets(cur => {
        const p1Targets = cur.filter(t => t.player === 1);
        const p2Targets = cur.filter(t => t.player === 2);
        const newTargets = [...cur];

        const generateTarget = (player: 1 | 2): DuelTarget => {
          const rand = Math.random();
          let type: DuelTarget['type'] = 'standard';
          let color = player === 1 ? '#38bdf8' : '#f43f5e';
          let points = 100;
          let hitsRemaining = 1;

          if (rand < sabotageChance) {
            type = 'sabotage';
            color = '#ec4899';
            points = 180;
          } else if (rand < sabotageChance + 0.18) {
            type = 'golden';
            color = '#f59e0b';
            points = 250;
          } else if (rand < sabotageChance + 0.28) {
            type = 'multi';
            color = '#f43f5e';
            points = 350;
            hitsRemaining = 2;
          } else if (rand < sabotageChance + 0.36) {
            type = 'vortex';
            color = '#a855f7';
            points = 280;
          }

          return {
            id: targetCounter.current++,
            player,
            x: Math.floor(15 + Math.random() * 70),
            y: Math.floor(20 + Math.random() * 60),
            duration: baseDuration,
            spawnTime: Date.now(),
            color,
            points,
            type,
            hitsRemaining,
            maxHits: hitsRemaining,
          };
        };

        if (p1Targets.length < maxTargetsPerPlayer) {
          newTargets.push(generateTarget(1));
        }

        if (p2Targets.length < maxTargetsPerPlayer) {
          newTargets.push(generateTarget(2));
        }

        return newTargets;
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, [gameState, p1Score, p2Score, speedMode]);

  // Expiration
  useEffect(() => {
    if (gameState !== 'playing') return;

    const cleaner = setInterval(() => {
      const now = Date.now();
      setTargets(cur => {
        const expired = cur.filter(t => now - t.spawnTime > t.duration);
        if (expired.length > 0) {
          expired.forEach(exp => {
            if (exp.player === 1) {
              p1MissesRef.current++;
              setP1Combo(0);
            } else {
              p2MissesRef.current++;
              setP2Combo(0);
            }
            replayEventsRef.current.push({
              id: `duel-miss-${exp.id}-${Date.now()}`,
              timestampMs: Math.max(0, now - matchStartTimeRef.current),
              type: 'miss',
              x: exp.x,
              y: exp.y,
              player: exp.player,
              reactionTimeMs: exp.duration,
              grade: 'MISS',
              points: 0,
              combo: 0,
              label: `P${exp.player} MISSED`,
              color: '#f43f5e',
            });
          });
        }
        return cur.filter(t => now - t.spawnTime <= t.duration);
      });
    }, 120);

    return () => clearInterval(cleaner);
  }, [gameState]);

  const spawnShockwave = (player: 1 | 2, x: number, y: number, color: string) => {
    const item: Shockwave = {
      id: Date.now() + Math.random(),
      player,
      x,
      y,
      color,
    };
    setShockwaves(prev => [...prev.slice(-6), item]);
    setTimeout(() => {
      setShockwaves(prev => prev.filter(s => s.id !== item.id));
    }, 480);
  };

  // Target Tap Handler
  const handleTap = (target: DuelTarget, e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation?.();
    }
    if (gameState !== 'playing') return;

    const isP1 = target.player === 1;
    const now = Date.now();
    const elapsed = now - target.spawnTime;

    // Multi-tap check
    if (target.type === 'multi' && target.hitsRemaining && target.hitsRemaining > 1) {
      soundEngine.playMultiTapCrack(1);
      triggerHaptic('tap');
      spawnShockwave(target.player, target.x, target.y, target.color);
      setTargets(cur => cur.map(t => t.id === target.id ? { ...t, hitsRemaining: (t.hitsRemaining || 2) - 1 } : t));
      return;
    }

    // Remove target immediately
    setTargets(cur => cur.filter(t => t.id !== target.id));
    spawnShockwave(target.player, target.x, target.y, target.color);

    const currentCombo = isP1 ? p1Combo : p2Combo;
    const nextCombo = currentCombo + 1;
    const mult = 1 + Math.floor(currentCombo / 6);
    const earnedPoints = target.points * mult;

    if (isP1) {
      p1ReactionTimesRef.current.push(elapsed);
      p1HitsRef.current++;
      p1MaxComboRef.current = Math.max(p1MaxComboRef.current, nextCombo);
      setP1Combo(c => c + 1);
      setP1Score(s => {
        const next = s + earnedPoints;
        if (next >= 1200) setTimeout(() => endMatch(), 50);
        return next;
      });
    } else {
      p2ReactionTimesRef.current.push(elapsed);
      p2HitsRef.current++;
      p2MaxComboRef.current = Math.max(p2MaxComboRef.current, nextCombo);
      setP2Combo(c => c + 1);
      setP2Score(s => {
        const next = s + earnedPoints;
        if (next >= 1200) setTimeout(() => endMatch(), 50);
        return next;
      });
    }

    // Combo milestones
    if (nextCombo > 0 && nextCombo % 5 === 0) {
      soundEngine.playComboMilestone(nextCombo);
    } else {
      soundEngine.playTap('PERFECT', nextCombo);
    }
    triggerHaptic('tap');

    // Vortex bomb: clear player's half
    if (target.type === 'vortex') {
      soundEngine.playVortexBlast();
      triggerHaptic('heavy');
      setTargets(cur => {
        const cleared = cur.filter(t => t.player === target.player && t.id !== target.id);
        const bonus = cleared.length * 120;
        if (bonus > 0) {
          if (isP1) setP1Score(s => s + bonus);
          else setP2Score(s => s + bonus);
        }
        return cur.filter(t => t.player !== target.player);
      });
    }

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

    // Record replay event
    replayEventsRef.current.push({
      id: `duel-hit-${Date.now()}-${Math.random()}`,
      timestampMs: Math.max(0, now - matchStartTimeRef.current),
      type: target.type === 'sabotage' ? 'sabotage' : target.type === 'golden' ? 'powerup' : 'hit',
      x: target.x,
      y: target.y,
      player: target.player,
      reactionTimeMs: elapsed,
      grade: elapsed < 230 ? 'PERFECT' : 'GREAT',
      points: earnedPoints,
      combo: nextCombo,
      label: target.type === 'sabotage' ? 'SABOTAGE STRIKE' : target.type === 'golden' ? 'GOLD PULSE' : elapsed < 230 ? 'PERFECT TAP' : 'HIT',
      color: target.color,
    });
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

    const p1Total = p1HitsRef.current + p1MissesRef.current;
    const p1Acc = p1Total > 0 ? Math.round((p1HitsRef.current / p1Total) * 1000) / 10 : 92;
    const p2Total = p2HitsRef.current + p2MissesRef.current;
    const p2Acc = p2Total > 0 ? Math.round((p2HitsRef.current / p2Total) * 1000) / 10 : 88;

    const p1Avg = p1ReactionTimesRef.current.length > 0
      ? Math.round(p1ReactionTimesRef.current.reduce((a: number, b: number) => a + b, 0) / p1ReactionTimesRef.current.length)
      : 235;
    const p2Avg = p2ReactionTimesRef.current.length > 0
      ? Math.round(p2ReactionTimesRef.current.reduce((a: number, b: number) => a + b, 0) / p2ReactionTimesRef.current.length)
      : 250;

    const fastestReaction = Math.min(
      ...(p1ReactionTimesRef.current.length > 0 ? p1ReactionTimesRef.current : [220]),
      ...(p2ReactionTimesRef.current.length > 0 ? p2ReactionTimesRef.current : [230])
    );

    const durationSeconds = Math.max(1, Math.round((Date.now() - matchStartTimeRef.current) / 1000));

    const duelAnalytics: MatchAnalytics = {
      id: `duel_analytics_${Date.now()}`,
      mode: 'duel',
      score: Math.max(p1Score, p2Score),
      accuracy: p1Acc,
      avgReactionTimeMs: p1Avg,
      fastestReactionMs: fastestReaction,
      maxCombo: Math.max(p1MaxComboRef.current, p2MaxComboRef.current, 1),
      perfectHits: p1HitsRef.current,
      greatHits: p2HitsRef.current,
      misses: p1MissesRef.current + p2MissesRef.current,
      durationSeconds,
      winner,
      duelDetails: {
        player1Name: `${profile.username} (Blue)`,
        player2Name: 'Challenger (Coral)',
        p1Score,
        p2Score,
        p1Accuracy: p1Acc,
        p2Accuracy: p2Acc,
        p1AvgReactionMs: p1Avg,
        p2AvgReactionMs: p2Avg,
        p1Hits: p1HitsRef.current,
        p2Hits: p2HitsRef.current,
      },
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      events: [...replayEventsRef.current],
    };

    onMatchComplete(record, duelAnalytics);
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

        {/* Player 2 Shockwaves */}
        {shockwaves.filter(sw => sw.player === 2).map(sw => (
          <div
            key={sw.id}
            className="anim-shockwave"
            style={{
              left: `${sw.x}%`,
              top: `${sw.y}%`,
              width: '70px',
              height: '70px',
              borderColor: sw.color,
              boxShadow: `0 0 14px ${sw.color}`,
            }}
          />
        ))}

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
              className="absolute inset-1 rounded-full border border-dashed opacity-70 animate-spin pointer-events-none"
            />

            {/* Multi-hit badge */}
            {target.type === 'multi' && (
              <div className="absolute -top-1 -right-1 z-10 px-1.5 py-0.5 rounded-full bg-pink-500 text-white font-mono font-black text-[9px] border border-white shadow">
                {target.hitsRemaining}x
              </div>
            )}

            <div className="pointer-events-none transition-transform">
              <TargetGlyph
                type={target.type}
                color={target.color}
                size={40}
                hitsRemaining={target.hitsRemaining}
                maxHits={target.maxHits}
              />
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

        {/* Center Countdown / Timer & Speed Mode */}
        <div className="z-10 flex items-center gap-1.5">
          <button
            id="duel-speed-mode-toggle"
            onClick={() => {
              soundEngine.playTap();
              triggerHaptic('tap');
              setSpeedMode(prev => (prev === 'turbo' ? 'overdrive' : prev === 'overdrive' ? 'standard' : 'turbo'));
            }}
            title="Toggle Duel Pacing"
            className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border transition active:scale-95 ${
              speedMode === 'overdrive'
                ? 'bg-rose-500/30 text-rose-300 border-rose-500/60 animate-pulse'
                : speedMode === 'turbo'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {speedMode === 'overdrive' ? '🔥 OVERDRIVE' : speedMode === 'turbo' ? '⚡ TURBO' : '⏱️ NORMAL'}
          </button>
          <div className="bg-slate-950/80 px-2 py-0.5 rounded-full border border-slate-700">
            <span className="text-xs font-mono font-black text-amber-400">
              ⏱️ {timeLeft}s
            </span>
          </div>
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

        {/* Player 1 Shockwaves */}
        {shockwaves.filter(sw => sw.player === 1).map(sw => (
          <div
            key={sw.id}
            className="anim-shockwave"
            style={{
              left: `${sw.x}%`,
              top: `${sw.y}%`,
              width: '70px',
              height: '70px',
              borderColor: sw.color,
              boxShadow: `0 0 14px ${sw.color}`,
            }}
          />
        ))}

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
              className="absolute inset-1 rounded-full border border-dashed opacity-70 animate-spin pointer-events-none"
            />

            {/* Multi-hit badge */}
            {target.type === 'multi' && (
              <div className="absolute -top-1 -right-1 z-10 px-1.5 py-0.5 rounded-full bg-pink-500 text-white font-mono font-black text-[9px] border border-white shadow">
                {target.hitsRemaining}x
              </div>
            )}

            <div className="pointer-events-none transition-transform">
              <TargetGlyph
                type={target.type}
                color={target.color}
                size={40}
                hitsRemaining={target.hitsRemaining}
                maxHits={target.maxHits}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Countdown Overlay */}
      {gameState === 'countdown' && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center z-40 p-6 text-center">
          <p className="text-sm font-bold text-cyan-400 mb-1 uppercase tracking-wider">
            {t.play_duel}
          </p>
          <div className="text-7xl font-black text-amber-400 font-mono animate-bounce my-2">
            {countdown > 0 ? countdown : 'FIGHT!'}
          </div>
          <p className="text-xs text-slate-300 max-w-xs leading-relaxed mb-4">
            {t.first_to_points}
          </p>

          {/* Velocity Preset Selector */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
              Duel Velocity:
            </span>
            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
              <button
                id="duel-countdown-speed-turbo"
                onClick={() => {
                  setSpeedMode('turbo');
                  soundEngine.playTap();
                  triggerHaptic('tap');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition active:scale-95 ${
                  speedMode === 'turbo'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚡ TURBO (Fast)
              </button>
              <button
                id="duel-countdown-speed-overdrive"
                onClick={() => {
                  setSpeedMode('overdrive');
                  soundEngine.playTap();
                  triggerHaptic('tap');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition active:scale-95 ${
                  speedMode === 'overdrive'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 animate-pulse'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🔥 OVERDRIVE (Insane)
              </button>
              <button
                id="duel-countdown-speed-standard"
                onClick={() => {
                  setSpeedMode('standard');
                  soundEngine.playTap();
                  triggerHaptic('tap');
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                  speedMode === 'standard'
                    ? 'bg-slate-700 text-white shadow-md'
                    : 'text-slate-500 hover:text-white'
                }`}
              >
                ⏱️ Normal
              </button>
            </div>
          </div>
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
