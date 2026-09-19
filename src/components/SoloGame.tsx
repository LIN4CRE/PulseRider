import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, Pause, Play, RotateCcw, Zap, Flame, Shield, ArrowLeft, Trophy, Gauge, Sparkles, Palette, Activity } from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, MatchAnalytics, PulseTarget, ReplayEvent } from '../types';
import { translations } from '../i18n/translations';
import { soundEngine, triggerHaptic } from '../services/audio';
import { TargetGlyph } from './TargetGlyph';

interface SoloGameProps {
  profile: UserProfile;
  onGameOver: (analytics: MatchAnalytics, newHighScore: boolean) => void;
  onBackToMenu: () => void;
}

interface FloatingScore {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  points?: string;
}

interface HitParticle {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  color: string;
  size: number;
}

interface Shockwave {
  id: number;
  x: number;
  y: number;
  color: string;
}

export const SoloGame: React.FC<SoloGameProps> = ({
  profile,
  onGameOver,
  onBackToMenu,
}) => {
  const t = translations[profile.language] || translations.en;
  const isDark = profile.theme === 'dark';

  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'ended'>('countdown');
  const [speedMode, setSpeedMode] = useState<'turbo' | 'overdrive' | 'standard'>(profile.speedPreference || 'turbo');
  const [skin, setSkin] = useState<'cyber' | 'synthwave' | 'emerald' | 'hyper'>(profile.skinPreference || 'cyber');
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [hasShield, setHasShield] = useState(false);
  const [feverActive, setFeverActive] = useState(false);
  const [feverTimer, setFeverTimer] = useState(0);
  const [feverEnergy, setFeverEnergy] = useState(0); // 0 to 100%
  const [slowMoActive, setSlowMoActive] = useState(false);
  const [currentFps, setCurrentFps] = useState(60);
  const [latestReactionMs, setLatestReactionMs] = useState<number | null>(null);
  const [fastestReactionMs, setFastestReactionMs] = useState<number | null>(null);

  // Performance analytics tracking
  const [perfectCount, setPerfectCount] = useState(0);
  const [greatCount, setGreatCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);

  // Dynamic Difficulty Adjustment (DDA) Engine
  // Evaluates rolling accuracy and unbroken combo in real-time to adjust spawn interval, target lifetime, and timing windows
  const [dynamicDifficulty, setDynamicDifficulty] = useState<number>(1.0);
  const [peakDynamicDifficulty, setPeakDynamicDifficulty] = useState<number>(1.0);
  const [recentAccuracyPct, setRecentAccuracyPct] = useState<number>(100);
  const recentOutcomesRef = useRef<Array<'PERFECT' | 'GREAT' | 'GOOD' | 'MISS'>>([]);
  const dynamicDifficultyRef = useRef<number>(1.0);
  const lastTierRef = useRef<'RECOVER' | 'STEADY' | 'SURGE' | 'HYPER' | 'OVERLOAD'>('STEADY');

  const getDifficultyTier = useCallback((diff: number): 'RECOVER' | 'STEADY' | 'SURGE' | 'HYPER' | 'OVERLOAD' => {
    if (diff >= 1.75) return 'OVERLOAD';
    if (diff >= 1.45) return 'HYPER';
    if (diff >= 1.20) return 'SURGE';
    if (diff >= 0.95) return 'STEADY';
    return 'RECOVER';
  }, []);

  const difficultyTier = getDifficultyTier(dynamicDifficulty);

  // Dynamic timing window tolerances:
  // Baseline (1.0x): PERFECT tolerance = 0.100, GREAT tolerance = 0.200
  // Overload (1.8x+): PERFECT tolerance narrows down to ~0.060, GREAT narrows down to ~0.135
  // Recover (< 1.0x): Windows expand up to 0.115 and 0.225 to assist recovery
  const perfectTolerance = Math.max(0.048, 0.10 / Math.pow(dynamicDifficulty, 0.75));
  const greatTolerance = Math.max(0.095, 0.20 / Math.pow(dynamicDifficulty, 0.65));

  const updateDynamicDifficulty = useCallback((outcome: 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS', currentCombo: number) => {
    const history = [...recentOutcomesRef.current.slice(-11), outcome];
    recentOutcomesRef.current = history;

    const total = history.length;
    const hits = history.filter(o => o !== 'MISS').length;
    const perfects = history.filter(o => o === 'PERFECT').length;
    const misses = history.filter(o => o === 'MISS').length;

    const accPct = total > 0 ? Math.round((hits / total) * 100) : 100;
    setRecentAccuracyPct(accPct);

    // 1. Combo Factor: rewards unbroken precision streaks (up to +0.55x at 18+ combo)
    const comboFactor = Math.min(0.55, currentCombo * 0.032);

    // 2. Accuracy Factor: rewards sustained PERFECT/GREAT hit rate (up to +0.35x)
    const accRatio = hits / total;
    const perfectRatio = perfects / total;
    const accuracyFactor = (accRatio - 0.70) * 0.45 + (perfectRatio * 0.20);

    // 3. Struggle / Miss dampener: gives recovery window when player misses
    const missPenalty = (misses / total) * 0.50;

    // Aggregate dynamic multiplier: ranges from 0.80 (recovery aid) to 1.95 (peak flow overload)
    const rawMultiplier = 1.0 + comboFactor + accuracyFactor - missPenalty;
    const clamped = Math.min(1.95, Math.max(0.80, Math.round(rawMultiplier * 100) / 100));

    dynamicDifficultyRef.current = clamped;
    setDynamicDifficulty(clamped);
    setPeakDynamicDifficulty(prev => Math.max(prev, clamped));

    // Audio & visual alert when crossing into higher difficulty tiers!
    const newTier = getDifficultyTier(clamped);
    const oldTier = lastTierRef.current;
    if (newTier !== oldTier) {
      lastTierRef.current = newTier;
      if (clamped >= 1.20 && (
        (newTier === 'OVERLOAD' && oldTier !== 'OVERLOAD') ||
        (newTier === 'HYPER' && oldTier === 'SURGE') ||
        (newTier === 'SURGE' && oldTier === 'STEADY')
      )) {
        soundEngine.playComboMilestone(10);
        triggerHaptic('success');
        const tierLabel = newTier === 'OVERLOAD' ? '⚡ OVERLOAD TEMPO [1.8x]' : newTier === 'HYPER' ? '🔥 HYPER INTENSITY [1.5x]' : '⚡ TEMPO SURGE [1.2x]';
        spawnFloatingScore(50, 30, tierLabel, newTier === 'OVERLOAD' ? 'text-purple-300' : newTier === 'HYPER' ? 'text-rose-400' : 'text-amber-400');
      }
    }
  }, [getDifficultyTier]);

  // Floating score tags, shockwaves & particle sparks
  const [floatingScores, setFloatingScores] = useState<FloatingScore[]>([]);
  const [particles, setParticles] = useState<HitParticle[]>([]);
  const [shockwaves, setShockwaves] = useState<Shockwave[]>([]);

  // Targets currently on board
  const [targets, setTargets] = useState<PulseTarget[]>([]);
  const targetIdCounter = useRef(1);
  const arenaRef = useRef<HTMLDivElement>(null);
  const frameCountRef = useRef(0);
  const lastFpsCheckRef = useRef(performance.now());
  const lastTapHandledTimeRef = useRef(0);
  const matchStartTimeRef = useRef(Date.now());
  const replayEventsRef = useRef<ReplayEvent[]>([]);

  // 60fps monitor loop
  useEffect(() => {
    let animId: number;
    const checkFps = () => {
      frameCountRef.current++;
      const now = performance.now();
      if (now - lastFpsCheckRef.current >= 1000) {
        const delta = (now - lastFpsCheckRef.current) / 1000;
        const calculatedFps = Math.min(120, Math.round(frameCountRef.current / delta));
        setCurrentFps(calculatedFps);
        frameCountRef.current = 0;
        lastFpsCheckRef.current = now;
      }
      animId = requestAnimationFrame(checkFps);
    };
    animId = requestAnimationFrame(checkFps);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Countdown effect
  useEffect(() => {
    if (gameState === 'countdown') {
      if (countdown > 0) {
        soundEngine.playTap();
        const timer = setTimeout(() => setCountdown(countdown - 1), 750);
        return () => clearTimeout(timer);
      } else {
        matchStartTimeRef.current = Date.now();
        replayEventsRef.current = [];
        setGameState('playing');
        soundEngine.playPowerUp();
      }
    }
  }, [countdown, gameState]);

  // Fever timer
  useEffect(() => {
    if (feverActive && feverTimer > 0 && gameState === 'playing') {
      const interval = setInterval(() => {
        setFeverTimer(prev => {
          if (prev <= 1) {
            setFeverActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [feverActive, feverTimer, gameState]);

  // Spawner loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    // High velocity spawn parameters based on speed mode
    let baseInterval = Math.max(260, 520 - Math.min(score / 35, 260));
    let duration = slowMoActive ? 1400 : Math.max(580, 1050 - Math.min(score / 30, 470));
    let maxTargets = 7;
    let hazardChance = 0.14;

    if (speedMode === 'overdrive') {
      baseInterval = Math.max(170, 340 - Math.min(score / 25, 170));
      duration = slowMoActive ? 1000 : Math.max(420, 740 - Math.min(score / 25, 320));
      maxTargets = 8;
      hazardChance = 0.18;
    } else if (speedMode === 'standard') {
      baseInterval = Math.max(450, 850 - Math.min(score / 50, 400));
      duration = slowMoActive ? 2200 : Math.max(1000, 1550 - Math.min(score / 45, 550));
      maxTargets = 5;
      hazardChance = 0.11;
    }

    // Dynamic Difficulty Adjustment:
    // Scale spawn interval and target collapse duration dynamically based on real-time combo & accuracy
    const currentDiff = dynamicDifficultyRef.current;
    const intervalTime = slowMoActive
      ? Math.round(baseInterval * 1.4)
      : Math.max(120, Math.round(baseInterval / currentDiff));
    const effectiveMaxTargets = currentDiff >= 1.70 ? maxTargets + 2 : currentDiff >= 1.35 ? maxTargets + 1 : maxTargets;
    const effectiveHazardChance = currentDiff >= 1.50 ? Math.min(0.24, hazardChance * 1.25) : hazardChance;

    // Get color based on selected theme skin
    const standardColor = skin === 'synthwave' ? '#f43f5e' : skin === 'emerald' ? '#10b981' : skin === 'hyper' ? '#8b5cf6' : '#38bdf8';

    const spawner = setInterval(() => {
      setTargets(current => {
        if (current.length >= effectiveMaxTargets) return current;

        const id = targetIdCounter.current++;
        // Keep within 15% to 85% so targets don't clip outside arena bounds
        const x = Math.floor(15 + Math.random() * 70);
        const y = Math.floor(15 + Math.random() * 70);

        const rand = Math.random();
        let type: PulseTarget['type'] = 'standard';
        let color = standardColor;
        let points = 200;
        let hitsRemaining = 1;

        if (rand < effectiveHazardChance) {
          type = 'hazard'; // Red danger
          color = '#ef4444';
        } else if (rand < effectiveHazardChance + 0.08) {
          type = 'golden'; // Fever Surge
          color = '#f59e0b';
          points = 500;
        } else if (rand < effectiveHazardChance + 0.14) {
          type = 'multi'; // Double Tap
          color = '#ec4899';
          points = 400;
          hitsRemaining = 2;
        } else if (rand < effectiveHazardChance + 0.20) {
          type = 'vortex'; // Shockwave Bomb
          color = '#8b5cf6';
          points = 300;
        } else if (rand < effectiveHazardChance + 0.26) {
          type = 'freeze'; // Slow-mo
          color = '#06b6d4';
          points = 250;
        } else if (rand < effectiveHazardChance + 0.32) {
          type = 'surge'; // Shield
          color = '#c084fc';
          points = 250;
        } else if (rand < effectiveHazardChance + 0.38) {
          type = 'phantom'; // Quantum Mirage
          color = '#22d3ee';
          points = 350;
        }

        // Collapse duration dynamically tightens as difficulty increases
        const targetDuration = slowMoActive
          ? duration
          : Math.max(360, Math.round(duration / Math.pow(dynamicDifficultyRef.current, 0.65)));

        return [
          ...current,
          {
            id,
            x,
            y,
            radius: 36,
            spawnTime: Date.now(),
            duration: targetDuration,
            points,
            type,
            color,
            hitsRemaining,
            maxHits: hitsRemaining,
          },
        ];
      });
    }, intervalTime);

    return () => clearInterval(spawner);
  }, [gameState, score, slowMoActive, speedMode, skin, Math.round(dynamicDifficulty * 10) / 10]);

  // Expiration check loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const cleanup = setInterval(() => {
      const now = Date.now();
      setTargets(current => {
        const expired = current.filter(t => now - t.spawnTime > t.duration && !t.tapped);
        if (expired.length > 0) {
          expired.forEach(exp => {
            if (exp.type !== 'hazard') {
              // Missed a valid target!
              handleTargetMiss(exp);
            } else {
              // Successfully avoided a hazard! Award small evasion bonus
              setScore(s => s + 50);
              spawnFloatingScore(exp.x, exp.y, 'EVADED!', 'text-emerald-400', '+50');
            }
          });
        }
        return current.filter(t => now - t.spawnTime <= t.duration && !t.tapped);
      });
    }, 80);

    return () => clearInterval(cleanup);
  }, [gameState, hasShield]);

  const spawnShockwave = (x: number, y: number, color: string) => {
    const item: Shockwave = {
      id: Date.now() + Math.random(),
      x,
      y,
      color,
    };
    setShockwaves(prev => [...prev.slice(-5), item]);
    setTimeout(() => {
      setShockwaves(prev => prev.filter(s => s.id !== item.id));
    }, 480);
  };

  const spawnParticles = (xPct: number, yPct: number, color: string) => {
    const newParticles: HitParticle[] = [];
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const dist = 35 + Math.random() * 45;
      newParticles.push({
        id: Date.now() + Math.random(),
        x: xPct,
        y: yPct,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist,
        color,
        size: 3 + Math.random() * 4,
      });
    }
    setParticles(prev => [...prev.slice(-25), ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id)));
    }, 550);
  };

  const spawnFloatingScore = (x: number, y: number, text: string, color: string, points?: string) => {
    const item: FloatingScore = {
      id: Date.now() + Math.random(),
      x,
      y,
      text,
      color,
      points,
    };
    setFloatingScores(prev => [...prev.slice(-8), item]);
    setTimeout(() => {
      setFloatingScores(prev => prev.filter(f => f.id !== item.id));
    }, 650);
  };

  const handleTargetMiss = useCallback((target?: PulseTarget) => {
    if (hasShield) {
      setHasShield(false);
      soundEngine.playShieldBlock();
      triggerHaptic('tap');
      spawnFloatingScore(target?.x ?? 50, target?.y ?? 40, 'SHIELD BROKEN', 'text-purple-400');
      return;
    }

    // Record miss event for replay
    replayEventsRef.current.push({
      id: `ev-miss-${Date.now()}-${Math.random()}`,
      timestampMs: Math.max(0, Date.now() - matchStartTimeRef.current),
      type: 'miss',
      x: target?.x ?? 50,
      y: target?.y ?? 40,
      reactionTimeMs: target?.duration ?? 420,
      grade: 'MISS',
      points: 0,
      combo: 0,
      label: 'MISSED TARGET',
      color: '#f43f5e',
    });

    soundEngine.playMiss();
    triggerHaptic('error');
    setCombo(0);
    setFeverEnergy(prev => Math.max(0, prev - 15)); // Penalize fever energy on miss
    setMissCount(m => m + 1);
    spawnFloatingScore(target?.x ?? 50, target?.y ?? 35, t.miss, 'text-rose-500');

    // Dynamic difficulty relaxation on miss
    updateDynamicDifficulty('MISS', 0);

    setLives(prevLives => {
      const next = prevLives - 1;
      if (next <= 0) {
        endGame();
      }
      return Math.max(0, next);
    });
  }, [hasShield, t.miss]);

  const handleTargetTap = (target: PulseTarget, e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation?.();
    }
    lastTapHandledTimeRef.current = Date.now();

    if (gameState !== 'playing' || target.tapped) return;

    const now = Date.now();
    const elapsed = now - target.spawnTime;
    const progress = elapsed / target.duration; // 0 (start) to 1 (expired)

    // Calculate reaction time benchmark
    setReactionTimes(prev => [...prev, elapsed]);
    setLatestReactionMs(elapsed);
    setFastestReactionMs(cur => cur ? Math.min(cur, elapsed) : elapsed);

    // Multi-Hit Check: Needs 2 taps
    if (target.type === 'multi' && target.hitsRemaining && target.hitsRemaining > 1) {
      soundEngine.playMultiTapCrack(1);
      triggerHaptic('tap');
      spawnParticles(target.x, target.y, '#ec4899');
      spawnShockwave(target.x, target.y, '#ec4899');
      spawnFloatingScore(target.x, target.y, '1 HIT LEFT!', 'text-pink-400');
      setTargets(cur => cur.map(t => t.id === target.id ? { ...t, hitsRemaining: (t.hitsRemaining || 2) - 1 } : t));
      return;
    }

    // Mark as tapped immediately to prevent double hits
    setTargets(cur => cur.filter(t => t.id !== target.id));

    // Spawn sparks & shockwave
    spawnParticles(target.x, target.y, target.color);
    spawnShockwave(target.x, target.y, target.color);

    // Handle Hazard
    if (target.type === 'hazard') {
      replayEventsRef.current.push({
        id: `ev-haz-${Date.now()}-${Math.random()}`,
        timestampMs: Math.max(0, now - matchStartTimeRef.current),
        type: 'hazard',
        x: target.x,
        y: target.y,
        reactionTimeMs: elapsed,
        grade: 'HAZARD',
        points: -200,
        combo: 0,
        label: 'HAZARD HIT',
        color: '#ef4444',
      });

      if (hasShield) {
        setHasShield(false);
        soundEngine.playShieldBlock();
        spawnFloatingScore(target.x, target.y, 'SHIELD DEFLECTED HAZARD!', 'text-purple-400');
        return;
      }

      soundEngine.playMiss();
      triggerHaptic('heavy');
      setCombo(0);
      setFeverEnergy(0);
      setScore(s => Math.max(0, s - 200));
      setMissCount(m => m + 1);
      spawnFloatingScore(target.x, target.y, 'HAZARD HIT!', 'text-red-500', '-200');

      // Hazard penalty on dynamic difficulty
      updateDynamicDifficulty('MISS', 0);

      setLives(l => {
        const next = l - 1;
        if (next <= 0) endGame();
        return Math.max(0, next);
      });
      return;
    }

    // Vortex Bomb: Clear screen
    if (target.type === 'vortex') {
      soundEngine.playVortexBlast();
      triggerHaptic('heavy');
      spawnShockwave(target.x, target.y, '#8b5cf6');
      setTargets(cur => {
        const targetsToClear = cur.filter(t => t.id !== target.id && t.type !== 'hazard');
        const bonus = targetsToClear.length * 150;
        if (bonus > 0) {
          setScore(s => s + bonus);
          spawnFloatingScore(target.x, target.y - 6, `VORTEX BLAST +${bonus}!`, 'text-purple-300');
        }
        return cur.filter(t => t.type === 'hazard');
      });
    }

    // Power-ups
    if (target.type === 'golden') {
      setFeverActive(true);
      setFeverTimer(7);
      soundEngine.playFeverIgnite();
      triggerHaptic('success');
      spawnFloatingScore(target.x, target.y, 'FEVER 3X!', 'text-amber-400', '+500');
    } else if (target.type === 'freeze') {
      setSlowMoActive(true);
      setTimeout(() => setSlowMoActive(false), 4500);
      soundEngine.playPowerUp();
      triggerHaptic('tap');
      spawnFloatingScore(target.x, target.y, 'SLOW-MO ACTIVE', 'text-cyan-400', '+250');
    } else if (target.type === 'surge') {
      setHasShield(true);
      soundEngine.playPowerUp();
      triggerHaptic('tap');
      spawnFloatingScore(target.x, target.y, 'SHIELD CHARGED!', 'text-purple-400', '+250');
    } else if (target.type === 'phantom') {
      soundEngine.playPowerUp();
      triggerHaptic('tap');
      spawnFloatingScore(target.x, target.y, 'QUANTUM MIRAGE!', 'text-cyan-300', '+350');
    }

    // Ultra-Fast Reaction Time Feedback
    if (elapsed < 165) {
      soundEngine.playReactionGodlike();
    }

    // Dynamic Timing Windows:
    // As dynamic difficulty increases (1.0x -> 1.95x), timing precision thresholds tighten in real time!
    // Baseline: PERFECT is < 0.100, GREAT is < 0.200.
    // In OVERLOAD (1.8x+): PERFECT shrinks to ~0.060, GREAT shrinks to ~0.135.
    // In RECOVER (< 1.0x): PERFECT expands slightly to ~0.115 to provide recovery forgiveness.
    const currentDiff = dynamicDifficultyRef.current;
    const currentPerfectTolerance = Math.max(0.048, 0.10 / Math.pow(currentDiff, 0.75));
    const currentGreatTolerance = Math.max(0.095, 0.20 / Math.pow(currentDiff, 0.65));

    const accuracyDelta = Math.abs(progress - 0.76);
    let hitGrade: 'PERFECT' | 'GREAT' | 'GOOD' = 'GOOD';
    let addedPoints = target.points;

    // High dynamic intensity rewards greater score multipliers!
    const difficultyScoreBonus = Math.max(0.9, 1 + (currentDiff - 1) * 0.45);

    if (accuracyDelta < currentPerfectTolerance) {
      hitGrade = 'PERFECT';
      addedPoints = Math.round(target.points * 1.5 * difficultyScoreBonus);
      setPerfectCount(p => p + 1);
      soundEngine.playTap('PERFECT', combo + 1);
      triggerHaptic('tap');
      const label = currentDiff >= 1.5 ? 'CRITICAL PERFECT!' : t.perfect;
      spawnFloatingScore(target.x, target.y, label, 'text-emerald-400', `+${addedPoints} • ${elapsed}ms`);
    } else if (accuracyDelta < currentGreatTolerance) {
      hitGrade = 'GREAT';
      addedPoints = Math.round(target.points * 1.2 * difficultyScoreBonus);
      setGreatCount(g => g + 1);
      soundEngine.playTap('GREAT', combo + 1);
      triggerHaptic('tap');
      spawnFloatingScore(target.x, target.y, t.great, 'text-cyan-300', `+${addedPoints} • ${elapsed}ms`);
    } else {
      soundEngine.playTap('GOOD', combo + 1);
      triggerHaptic('tap');
      addedPoints = Math.round(target.points * difficultyScoreBonus);
      spawnFloatingScore(target.x, target.y, 'GOOD', 'text-blue-300', `+${addedPoints} • ${elapsed}ms`);
    }

    // Dynamic difficulty adjustment based on outcome and streak
    updateDynamicDifficulty(hitGrade, combo + 1);

    // Fever Supercharge Gauge increase
    setFeverEnergy(prev => {
      const gain = hitGrade === 'PERFECT' ? 14 : target.type === 'multi' ? 20 : 8;
      const next = prev + gain;
      if (next >= 100 && !feverActive) {
        setFeverActive(true);
        setFeverTimer(7);
        soundEngine.playFeverIgnite();
        triggerHaptic('success');
        spawnFloatingScore(50, 25, '⚡ SUPERCHARGE FEVER!', 'text-amber-300');
        return 0;
      }
      return Math.min(100, next);
    });

    const currentMultiplier = feverActive ? 3 : Math.min(4, 1 + Math.floor(combo / 8));
    const speedBonus = speedMode === 'overdrive' ? 1.5 : 1;
    const totalGain = Math.round(addedPoints * currentMultiplier * speedBonus);

    // Record hit event for match replay
    replayEventsRef.current.push({
      id: `ev-hit-${Date.now()}-${Math.random()}`,
      timestampMs: Math.max(0, now - matchStartTimeRef.current),
      type: target.type !== 'standard' ? 'powerup' : 'hit',
      x: target.x,
      y: target.y,
      reactionTimeMs: elapsed,
      grade: hitGrade,
      points: totalGain,
      combo: combo + 1,
      label: target.type === 'golden' ? 'FEVER 3X' : target.type === 'freeze' ? 'SLOW-MO' : target.type === 'surge' ? 'SHIELD' : hitGrade,
      color: target.color,
    });

    setScore(s => s + totalGain);
    setCombo(c => {
      const next = c + 1;
      setMaxCombo(mc => Math.max(mc, next));

      // Combo milestone fanfare
      if ([5, 10, 20, 30, 50, 75, 100].includes(next)) {
        soundEngine.playComboMilestone(next);
        spawnFloatingScore(target.x, target.y - 8, `🔥 ${next}X STREAK!`, 'text-amber-400');
      }
      return next;
    });
  };

  const handleArenaTap = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameState !== 'playing') return;

    // Discard synthetic / bubble events right after a target tap (reduced for ultra-fast multi-tapping)
    if (Date.now() - lastTapHandledTimeRef.current < 100) {
      return;
    }

    // Proximity target matching: if tap was within 12% screen radius of an active target, register as a hit
    const rect = arenaRef.current?.getBoundingClientRect();
    if (rect && targets.length > 0) {
      const tapX = ((e.clientX - rect.left) / rect.width) * 100;
      const tapY = ((e.clientY - rect.top) / rect.height) * 100;

      let closestTarget: PulseTarget | null = null;
      let minDistance = Infinity;

      for (const t of targets) {
        if (t.tapped) continue;
        const dist = Math.hypot(t.x - tapX, t.y - tapY);
        if (dist < minDistance) {
          minDistance = dist;
          closestTarget = t;
        }
      }

      // If finger was near any target, register the hit
      if (closestTarget && minDistance < 13) {
        handleTargetTap(closestTarget, e);
        return;
      }
    }

    // Tapping completely empty space:
    // Only reset combo and play soft air swoosh; NEVER deduct lives!
    if (combo > 0) {
      setCombo(0);
      spawnFloatingScore(50, 40, 'COMBO BREAK', 'text-slate-400');
      updateDynamicDifficulty('MISS', 0);
    }
    soundEngine.playEmptyTap();
  };

  const endGame = () => {
    setGameState('ended');
    soundEngine.playMiss();
    triggerHaptic('error');

    const totalHits = perfectCount + greatCount + missCount;
    const accuracy = totalHits > 0 ? Math.round(((perfectCount + greatCount) / totalHits) * 1000) / 10 : 100;
    const avgReaction = reactionTimes.length > 0 
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 220;
    const fastestReaction = reactionTimes.length > 0 ? Math.min(...reactionTimes) : Math.round(avgReaction * 0.8);
    const durationSeconds = Math.max(1, Math.round((Date.now() - matchStartTimeRef.current) / 1000));

    const isNewHigh = score > profile.highScore;
    if (isNewHigh) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
      soundEngine.playVictory();
    }

    const analytics: MatchAnalytics = {
      id: `match_${Date.now()}`,
      mode: 'solo',
      score,
      accuracy,
      avgReactionTimeMs: avgReaction,
      fastestReactionMs: fastestReaction,
      maxCombo,
      perfectHits: perfectCount,
      greatHits: greatCount,
      misses: missCount,
      peakDynamicDifficulty,
      durationSeconds,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      events: [...replayEventsRef.current],
    };

    onGameOver(analytics, isNewHigh);
  };

  const cycleSpeedMode = () => {
    soundEngine.playTap();
    triggerHaptic('tap');
    setSpeedMode(prev => {
      const next = prev === 'turbo' ? 'overdrive' : prev === 'overdrive' ? 'standard' : 'turbo';
      return next;
    });
  };

  return (
    <div
      id="solo-game-container"
      className={`relative w-full h-[calc(100vh-62px)] max-w-md mx-auto flex flex-col select-none overflow-hidden ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* HUD Header */}
      <div className={`flex flex-col border-b backdrop-blur-md z-20 transition-colors ${
        feverActive 
          ? 'bg-amber-950/40 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
          : isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center justify-between px-3 py-2">
          {/* Lives & Shield */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              {[...Array(3)].map((_, i) => (
                <Heart
                  key={i}
                  className={`w-4 h-4 transition-transform duration-200 ${
                    i < lives ? 'text-rose-500 fill-rose-500 scale-100' : 'text-slate-600 scale-75'
                  }`}
                />
              ))}
            </div>
            {hasShield && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/40 text-[10px] font-bold">
                <Shield className="w-3 h-3" />
              </span>
            )}
          </div>

          {/* Score and Combo Center */}
          <div className="text-center">
            <div className="font-extrabold text-xl tracking-tight font-mono text-cyan-400">
              {score.toLocaleString()}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
              {combo > 3 && (
                <span className="flex items-center text-amber-400 animate-pulse font-mono">
                  <Flame className="w-3.5 h-3.5 fill-amber-400" /> {combo}x COMBO
                </span>
              )}
              {feverActive ? (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-extrabold text-[9px] border border-amber-500/30">
                  FEVER 3X ({feverTimer}s)
                </span>
              ) : latestReactionMs ? (
                <span className={`font-mono text-[9px] font-bold ${
                  latestReactionMs < 170 ? 'text-emerald-400' : latestReactionMs < 240 ? 'text-cyan-400' : 'text-slate-400'
                }`}>
                  ⚡ {latestReactionMs}ms
                </span>
              ) : null}
            </div>
          </div>

          {/* Speed Mode Pill & Controls */}
          <div className="flex items-center gap-1">
            {/* Target Skin Cycle */}
            <button
              id="solo-skin-toggle"
              onClick={() => {
                soundEngine.playTap();
                triggerHaptic('tap');
                setSkin(prev => {
                  const next = prev === 'cyber' ? 'synthwave' : prev === 'synthwave' ? 'emerald' : prev === 'emerald' ? 'hyper' : 'cyber';
                  return next;
                });
              }}
              title="Change Target Skin Theme"
              className="p-1.5 rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-300 active:scale-95 transition"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>

            {/* Speed Mode Toggle */}
            <button
              id="solo-speed-mode-toggle"
              onClick={cycleSpeedMode}
              title="Switch Reflex Pacing: Turbo, Overdrive, Standard"
              className={`px-2 py-1 rounded-xl text-[10px] font-black tracking-wider uppercase border flex items-center gap-1 active:scale-95 transition ${
                speedMode === 'overdrive'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm shadow-rose-500/20 animate-pulse'
                  : speedMode === 'turbo'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {speedMode === 'overdrive' ? '🔥 OVERDRIVE' : speedMode === 'turbo' ? '⚡ TURBO' : '⏱️ NORMAL'}
            </button>

            <button
              id="solo-pause-btn"
              onClick={() => setGameState(gameState === 'playing' ? 'paused' : 'playing')}
              className={`p-1.5 rounded-xl transition active:scale-95 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
            >
              {gameState === 'playing' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              id="solo-exit-btn"
              onClick={onBackToMenu}
              className={`p-1.5 rounded-xl transition active:scale-95 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Supercharge Fever Energy Bar */}
        <div className="w-full h-1 bg-slate-800/80 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-200 ${
              feverActive
                ? 'bg-gradient-to-r from-amber-400 via-rose-500 to-amber-300 animate-pulse w-full'
                : 'bg-gradient-to-r from-cyan-500 to-amber-400'
            }`}
            style={{ width: feverActive ? '100%' : `${feverEnergy}%` }}
          />
        </div>

        {/* Dynamic Adaptive Pace HUD Bar */}
        <div className={`px-3 py-1 flex items-center justify-between border-t text-[10px] font-mono transition-colors ${
          difficultyTier === 'OVERLOAD'
            ? 'bg-purple-950/60 border-purple-500/40 text-purple-200'
            : difficultyTier === 'HYPER'
            ? 'bg-rose-950/50 border-rose-500/30 text-rose-200'
            : difficultyTier === 'SURGE'
            ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
            : difficultyTier === 'RECOVER'
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
            : isDark ? 'bg-slate-900/60 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
        }`}>
          {/* Left: Dynamic Intensity Multiplier & Tier */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase font-bold tracking-wider opacity-70">Pace:</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase border flex items-center gap-1 ${
              difficultyTier === 'OVERLOAD'
                ? 'bg-purple-500/30 text-purple-300 border-purple-400/60 shadow-[0_0_8px_rgba(168,85,247,0.4)] animate-pulse'
                : difficultyTier === 'HYPER'
                ? 'bg-rose-500/30 text-rose-300 border-rose-400/60 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                : difficultyTier === 'SURGE'
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                : difficultyTier === 'RECOVER'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                : 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
            }`}>
              {difficultyTier === 'OVERLOAD' ? '⚡ OVERLOAD' : difficultyTier === 'HYPER' ? '🔥 HYPER' : difficultyTier === 'SURGE' ? '⚡ SURGE' : difficultyTier === 'RECOVER' ? '🛡️ RECOVER' : '⏱️ STEADY'} {dynamicDifficulty.toFixed(2)}x
            </span>
          </div>

          {/* Right: Rolling Accuracy & Narrowed Timing Tolerance Window */}
          <div className="flex items-center gap-2 text-[9px]">
            <span title="Rolling Accuracy based on recent targets">
              Acc: <strong className={recentAccuracyPct >= 85 ? 'text-emerald-400 font-bold' : recentAccuracyPct >= 65 ? 'text-cyan-400 font-bold' : 'text-amber-400 font-bold'}>{recentAccuracyPct}%</strong>
            </span>
            <span className="opacity-40">•</span>
            <span title="Dynamic Perfect Window (shrinks with difficulty)">
              Window: <strong className="font-mono text-slate-200">±{Math.round(perfectTolerance * 1000) / 10}%</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Touch Arena Canvas */}
      <div
        ref={arenaRef}
        id="touch-game-arena"
        onPointerDown={handleArenaTap}
        className={`relative flex-1 w-full overflow-hidden select-none touch-none cursor-crosshair transition-all duration-300 ${
          feverActive ? 'anim-fever-aura' : difficultyTier === 'OVERLOAD' ? 'anim-overload-aura' : combo >= 6 ? 'anim-combo-aura' : ''
        } ${
          isDark
            ? 'bg-radial from-slate-900 via-slate-950 to-slate-950'
            : 'bg-radial from-slate-100 via-slate-50 to-slate-100'
        }`}
      >
        {/* Subtle cyber grid lines for depth */}
        <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,#06b6d4_1px,transparent_1px),linear-gradient(to_bottom,#06b6d4_1px,transparent_1px)] bg-[size:36px_36px] pointer-events-none" />

        {/* Slow-mo Frost Ambient Overlay */}
        {slowMoActive && (
          <div className="absolute inset-0 bg-cyan-500/10 backdrop-blur-[1px] border-2 border-cyan-400/40 pointer-events-none z-10 flex items-center justify-center">
            <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold text-xs tracking-widest border border-cyan-400/40">
              ❄️ CHRONO SLOW-MO
            </span>
          </div>
        )}

        {/* Shockwave Rings on Tap & Explosions */}
        {shockwaves.map(sw => (
          <div
            key={sw.id}
            className="anim-shockwave"
            style={{
              left: `${sw.x}%`,
              top: `${sw.y}%`,
              width: '80px',
              height: '80px',
              borderColor: sw.color,
              boxShadow: `0 0 16px ${sw.color}`,
            }}
          />
        ))}

        {/* Particle Sparks Burst */}
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              backgroundColor: p.color,
              width: `${p.size}px`,
              height: `${p.size}px`,
              boxShadow: `0 0 8px ${p.color}`,
              animation: 'particleBurst 500ms ease-out forwards',
              transform: `translate(${p.tx}px, ${p.ty}px)`,
              opacity: 0,
              transition: 'transform 500ms cubic-bezier(0,0,0.2,1), opacity 500ms ease-out',
            }}
          />
        ))}

        {/* Floating Score Popups at Tap Coordinates */}
        {floatingScores.map(item => (
          <div
            key={item.id}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30 flex flex-col items-center anim-hit-float drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
          >
            <span className={`font-black text-lg tracking-wider font-mono ${item.color}`}>
              {item.text}
            </span>
            {item.points && (
              <span className="text-xs font-bold font-mono text-white/90">
                {item.points}
              </span>
            )}
          </div>
        ))}

        {/* Active Pulse Targets with TargetGlyph Icons & Collapsing Timing Rings */}
        {targets.map(target => {
          return (
            <div
              key={target.id}
              id={`pulse-target-${target.id}`}
              style={{
                left: `${target.x}%`,
                top: `${target.y}%`,
              }}
              onPointerDown={(e) => handleTargetTap(target, e)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-24 h-24 flex items-center justify-center cursor-pointer select-none touch-none active:scale-95 transition-transform ${
                target.type === 'phantom' ? 'animate-pulse' : ''
              }`}
            >
              {/* Outer Collapsing Ring (Exact Timing Cue) */}
              <div
                style={{
                  animationDuration: `${target.duration}ms`,
                  borderColor: target.color,
                  boxShadow: `0 0 12px ${target.color}99`,
                }}
                className="absolute inset-0 rounded-full border-2 anim-collapse-ring pointer-events-none"
              />

              {/* Target Rotating Precision Reticle */}
              <div
                style={{
                  animationDuration: '6s',
                  borderColor: `${target.color}55`,
                }}
                className="absolute inset-2 rounded-full border border-dashed opacity-80 pointer-events-none animate-spin"
              />

              {/* Multi-hit outer count badge */}
              {target.type === 'multi' && (
                <div className="absolute -top-1 -right-1 z-10 px-1.5 py-0.5 rounded-full bg-pink-500 text-white font-mono font-black text-[10px] border border-white shadow-lg animate-bounce">
                  {target.hitsRemaining}x
                </div>
              )}

              {/* Target Custom SVG Glyph Icon */}
              <div className="pointer-events-none transition-transform">
                <TargetGlyph
                  type={target.type}
                  color={target.color}
                  size={target.type === 'vortex' ? 52 : 46}
                  hitsRemaining={target.hitsRemaining}
                  maxHits={target.maxHits}
                />
              </div>
            </div>
          );
        })}

        {/* Countdown Overlay */}
        {gameState === 'countdown' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30 p-4">
            <div className="text-7xl font-black text-cyan-400 font-mono animate-bounce">
              {countdown > 0 ? countdown : 'GO!'}
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-300 uppercase tracking-widest">
              {t.play_solo}
            </p>

            {/* Velocity Preset Selector */}
            <div className="mt-6 flex flex-col items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                Target Velocity & Reflex Tempo:
              </span>
              <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
                <button
                  id="countdown-speed-turbo"
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
                  id="countdown-speed-overdrive"
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
                  id="countdown-speed-standard"
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

            {/* Target Skin Palette Selector in Countdown */}
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                Visual Reticle Skin:
              </span>
              <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800">
                {(['cyber', 'synthwave', 'emerald', 'hyper'] as const).map(s => (
                  <button
                    key={s}
                    id={`skin-select-${s}`}
                    onClick={() => {
                      setSkin(s);
                      soundEngine.playTap();
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition ${
                      skin === s
                        ? s === 'cyber'
                          ? 'bg-cyan-500 text-slate-950'
                          : s === 'synthwave'
                          ? 'bg-rose-500 text-white'
                          : s === 'emerald'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-purple-500 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Paused Overlay */}
        {gameState === 'paused' && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center z-30 p-6">
            <h3 className="text-2xl font-black text-slate-100 mb-6 tracking-wide">PAUSED</h3>
            <div className="space-y-3 w-48">
              <button
                onClick={() => setGameState('playing')}
                className="w-full py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 hover:bg-cyan-400 active:scale-95 transition"
              >
                <Play className="w-4 h-4" /> Resume
              </button>
              <button
                onClick={onBackToMenu}
                className="w-full py-3 rounded-xl bg-slate-800 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-700 active:scale-95 transition"
              >
                <ArrowLeft className="w-4 h-4" /> Main Menu
              </button>
            </div>
          </div>
        )}

        {/* Game Over Summary Modal */}
        {gameState === 'ended' && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-30 p-5">
            <div className={`w-full max-w-xs rounded-2xl p-6 border shadow-2xl text-center ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                <Trophy className="w-6 h-6" />
              </div>
              
              <h3 className="text-xl font-black tracking-tight mb-1">{t.game_over}</h3>
              {score > profile.highScore && (
                <div className="inline-block px-2.5 py-0.5 mb-3 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold animate-pulse">
                  ⭐ NEW HIGH SCORE! ⭐
                </div>
              )}

              <div className="text-3xl font-black font-mono text-cyan-400 mb-2">
                {score.toLocaleString()}
              </div>
              <div className="mb-4">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border ${
                  speedMode === 'overdrive'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    : speedMode === 'turbo'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  {speedMode === 'overdrive' ? '🔥 OVERDRIVE MODE' : speedMode === 'turbo' ? '⚡ TURBO PACED' : '⏱️ NORMAL PACED'}
                </span>
              </div>

              {/* Performance Stats Grid */}
              <div className="grid grid-cols-2 gap-2 text-left mb-6 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">{t.combo_max}</span>
                  <span className="text-base font-mono font-bold text-amber-400">{maxCombo}x</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">{t.accuracy}</span>
                  <span className="text-base font-mono font-bold text-emerald-400">
                    {perfectCount + greatCount + missCount > 0
                      ? Math.round(((perfectCount + greatCount) / (perfectCount + greatCount + missCount)) * 100)
                      : 100}%
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Peak Dynamic Pace</span>
                  <span className={`text-base font-mono font-bold ${
                    peakDynamicDifficulty >= 1.75
                      ? 'text-purple-400'
                      : peakDynamicDifficulty >= 1.45
                      ? 'text-rose-400'
                      : peakDynamicDifficulty >= 1.20
                      ? 'text-amber-400'
                      : 'text-cyan-400'
                  }`}>
                    {peakDynamicDifficulty.toFixed(2)}x <span className="text-[9px] font-sans font-bold">({getDifficultyTier(peakDynamicDifficulty)})</span>
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Perfect Taps</span>
                  <span className="text-base font-mono font-bold text-cyan-300">{perfectCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">{t.avg_reaction}</span>
                    <span className="text-base font-mono font-bold text-purple-300">
                      {reactionTimes.length > 0 
                        ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length) 
                        : 210} ms
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  id="solo-play-again-btn"
                  onClick={() => {
                    setScore(0);
                    setCombo(0);
                    setMaxCombo(0);
                    setLives(3);
                    setPerfectCount(0);
                    setGreatCount(0);
                    setMissCount(0);
                    setReactionTimes([]);
                    setFloatingScores([]);
                    setParticles([]);
                    setDynamicDifficulty(1.0);
                    setPeakDynamicDifficulty(1.0);
                    setRecentAccuracyPct(100);
                    recentOutcomesRef.current = [];
                    dynamicDifficultyRef.current = 1.0;
                    lastTierRef.current = 'STEADY';
                    setCountdown(3);
                    setGameState('countdown');
                  }}
                  className="w-full py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 hover:bg-cyan-400 active:scale-95 transition"
                >
                  <RotateCcw className="w-4 h-4" /> {t.play_again}
                </button>
                <button
                  id="solo-menu-btn"
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
    </div>
  );
};

