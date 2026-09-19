import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, Pause, Play, RotateCcw, Zap, Flame, Shield, ArrowLeft, Trophy, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, MatchAnalytics, PulseTarget } from '../types';
import { translations } from '../i18n/translations';
import { soundEngine, triggerHaptic } from '../services/audio';

interface SoloGameProps {
  profile: UserProfile;
  onGameOver: (analytics: MatchAnalytics, newHighScore: boolean) => void;
  onBackToMenu: () => void;
}

export const SoloGame: React.FC<SoloGameProps> = ({
  profile,
  onGameOver,
  onBackToMenu,
}) => {
  const t = translations[profile.language] || translations.en;
  const isDark = profile.theme === 'dark';

  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'ended'>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [hasShield, setHasShield] = useState(false);
  const [feverActive, setFeverActive] = useState(false);
  const [feverTimer, setFeverTimer] = useState(0);
  const [slowMoActive, setSlowMoActive] = useState(false);
  
  // Performance analytics tracking
  const [perfectCount, setPerfectCount] = useState(0);
  const [greatCount, setGreatCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);

  // Feedback animations
  const [hitFeedback, setHitFeedback] = useState<{ text: string; color: string; id: number } | null>(null);

  // Targets currently on board
  const [targets, setTargets] = useState<PulseTarget[]>([]);
  const targetIdCounter = useRef(1);
  const arenaRef = useRef<HTMLDivElement>(null);

  // Countdown effect
  useEffect(() => {
    if (gameState === 'countdown') {
      if (countdown > 0) {
        soundEngine.playTap();
        const timer = setTimeout(() => setCountdown(countdown - 1), 750);
        return () => clearTimeout(timer);
      } else {
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

    // Escalating spawn rate based on score
    const baseInterval = Math.max(500, 1100 - Math.min(score / 50, 600));
    const intervalTime = slowMoActive ? baseInterval * 1.5 : baseInterval;

    const spawner = setInterval(() => {
      setTargets(current => {
        if (current.length >= 5) return current; // limit concurrent targets

        const id = targetIdCounter.current++;
        // Keep within 12% to 88% so targets don't clip outside mobile frame
        const x = Math.floor(12 + Math.random() * 74);
        const y = Math.floor(12 + Math.random() * 74);

        const rand = Math.random();
        let type: PulseTarget['type'] = 'standard';
        let color = '#38bdf8'; // neon cyan

        if (rand < 0.12) {
          type = 'hazard'; // Red danger
          color = '#ef4444';
        } else if (rand < 0.20) {
          type = 'golden'; // Fever Surge
          color = '#f59e0b';
        } else if (rand < 0.26) {
          type = 'freeze'; // Slow-mo
          color = '#06b6d4';
        } else if (rand < 0.32) {
          type = 'surge'; // Shield
          color = '#8b5cf6';
        }

        const duration = slowMoActive ? 2200 : Math.max(1200, 1900 - Math.min(score / 40, 700));

        return [
          ...current,
          {
            id,
            x,
            y,
            radius: 36,
            spawnTime: Date.now(),
            duration,
            points: type === 'golden' ? 500 : 200,
            type,
            color,
          },
        ];
      });
    }, intervalTime);

    return () => clearInterval(spawner);
  }, [gameState, score, slowMoActive]);

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
              handleTargetMiss();
            }
          });
        }
        return current.filter(t => now - t.spawnTime <= t.duration && !t.tapped);
      });
    }, 100);

    return () => clearInterval(cleanup);
  }, [gameState, hasShield]);

  const handleTargetMiss = useCallback(() => {
    if (hasShield) {
      setHasShield(false);
      soundEngine.playTap();
      triggerHaptic('tap');
      setHitFeedback({ text: 'SHIELD USED', color: 'text-purple-400', id: Date.now() });
      return;
    }

    soundEngine.playMiss();
    triggerHaptic('error');
    setCombo(0);
    setMissCount(m => m + 1);
    setHitFeedback({ text: t.miss, color: 'text-rose-500', id: Date.now() });

    setLives(prevLives => {
      const next = prevLives - 1;
      if (next <= 0) {
        endGame();
      }
      return Math.max(0, next);
    });
  }, [hasShield, t.miss]);

  const handleTargetTap = (target: PulseTarget, e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    if (gameState !== 'playing' || target.tapped) return;

    const now = Date.now();
    const elapsed = now - target.spawnTime;
    const progress = elapsed / target.duration; // 0 (start) to 1 (expired)

    // Calculate reaction time
    setReactionTimes(prev => [...prev, elapsed]);

    // Mark as tapped immediately to prevent double hits
    setTargets(cur => cur.filter(t => t.id !== target.id));

    // Handle Hazard
    if (target.type === 'hazard') {
      soundEngine.playMiss();
      triggerHaptic('heavy');
      setCombo(0);
      setScore(s => Math.max(0, s - 200));
      setMissCount(m => m + 1);
      setHitFeedback({ text: 'HAZARD HIT! -200', color: 'text-red-500', id: Date.now() });
      
      setLives(l => {
        const next = l - 1;
        if (next <= 0) endGame();
        return Math.max(0, next);
      });
      return;
    }

    // Power-ups
    if (target.type === 'golden') {
      setFeverActive(true);
      setFeverTimer(6);
      soundEngine.playPowerUp();
      triggerHaptic('success');
      setHitFeedback({ text: 'FEVER MODE 3X!', color: 'text-amber-400', id: Date.now() });
    } else if (target.type === 'freeze') {
      setSlowMoActive(true);
      setTimeout(() => setSlowMoActive(false), 4500);
      soundEngine.playPowerUp();
      triggerHaptic('tap');
      setHitFeedback({ text: 'SLOW-MO ACTIVE', color: 'text-cyan-400', id: Date.now() });
    } else if (target.type === 'surge') {
      setHasShield(true);
      soundEngine.playPowerUp();
      triggerHaptic('tap');
      setHitFeedback({ text: 'SHIELD CHARGED!', color: 'text-purple-400', id: Date.now() });
    }

    // Timing precision: optimal hit window is around 65% - 85% of ring collapse
    const accuracyDelta = Math.abs(progress - 0.75);
    let hitGrade: 'PERFECT' | 'GREAT' | 'GOOD' = 'GOOD';
    let addedPoints = target.points;

    if (accuracyDelta < 0.12) {
      hitGrade = 'PERFECT';
      addedPoints = Math.round(target.points * 1.5);
      setPerfectCount(p => p + 1);
      soundEngine.playTap(true, combo + 1);
      triggerHaptic('tap');
      setHitFeedback({ text: t.perfect, color: 'text-emerald-400', id: Date.now() });
    } else if (accuracyDelta < 0.22) {
      hitGrade = 'GREAT';
      addedPoints = Math.round(target.points * 1.2);
      setGreatCount(g => g + 1);
      soundEngine.playTap(false, combo + 1);
      triggerHaptic('tap');
      setHitFeedback({ text: t.great, color: 'text-cyan-300', id: Date.now() });
    } else {
      soundEngine.playTap(false, combo + 1);
      triggerHaptic('tap');
    }

    const currentMultiplier = feverActive ? 3 : Math.min(4, 1 + Math.floor(combo / 8));
    const totalGain = addedPoints * currentMultiplier;

    setScore(s => s + totalGain);
    setCombo(c => {
      const next = c + 1;
      setMaxCombo(mc => Math.max(mc, next));
      return next;
    });
  };

  const handleArenaMissClick = () => {
    if (gameState !== 'playing') return;
    handleTargetMiss();
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
      maxCombo,
      perfectHits: perfectCount,
      greatHits: greatCount,
      misses: missCount,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
    };

    onGameOver(analytics, isNewHigh);
  };

  return (
    <div
      id="solo-game-container"
      className={`relative w-full h-[calc(100vh-62px)] max-w-md mx-auto flex flex-col select-none overflow-hidden ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* HUD Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b backdrop-blur-md z-20 ${
        isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200 shadow-sm'
      }`}>
        {/* Lives & Shield */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1">
            {[...Array(3)].map((_, i) => (
              <Heart
                key={i}
                className={`w-5 h-5 transition-transform duration-200 ${
                  i < lives ? 'text-rose-500 fill-rose-500 scale-100' : 'text-slate-600 scale-75'
                }`}
              />
            ))}
          </div>
          {hasShield && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/40 text-[10px] font-bold">
              <Shield className="w-3 h-3" /> Shield
            </span>
          )}
        </div>

        {/* Score and Combo Center */}
        <div className="text-center">
          <div className="font-extrabold text-xl tracking-tight font-mono text-cyan-400">
            {score.toLocaleString()}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
            {combo > 3 && (
              <span className="flex items-center text-amber-400 animate-pulse">
                <Flame className="w-3 h-3 fill-amber-400" /> {combo}x COMBO
              </span>
            )}
            {feverActive && (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-extrabold text-[9px] border border-amber-500/30">
                FEVER 3X ({feverTimer}s)
              </span>
            )}
          </div>
        </div>

        {/* Pause & Exit Controls */}
        <div className="flex items-center gap-1.5">
          <button
            id="solo-pause-btn"
            onClick={() => setGameState(gameState === 'playing' ? 'paused' : 'playing')}
            className={`p-2 rounded-xl transition ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
          >
            {gameState === 'playing' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            id="solo-exit-btn"
            onClick={onBackToMenu}
            className={`p-2 rounded-xl transition ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Touch Arena Canvas */}
      <div
        ref={arenaRef}
        id="touch-game-arena"
        onTouchStart={handleArenaMissClick}
        onMouseDown={handleArenaMissClick}
        className={`relative flex-1 w-full overflow-hidden touch-none cursor-pointer ${
          isDark
            ? 'bg-radial from-slate-900 via-slate-950 to-slate-950'
            : 'bg-radial from-slate-100 via-slate-50 to-slate-100'
        }`}
      >
        {/* Subtle grid lines for depth */}
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:32px_32px]" />

        {/* Hit Quality Feedback Popup */}
        {hitFeedback && (
          <div
            key={hitFeedback.id}
            className={`absolute top-8 left-1/2 -translate-x-1/2 font-black text-xl tracking-wider pointer-events-none drop-shadow-md animate-out fade-out slide-out-to-top-4 duration-300 ${hitFeedback.color}`}
          >
            {hitFeedback.text}
          </div>
        )}

        {/* Active Pulse Spheres */}
        {targets.map(target => {
          const isHazard = target.type === 'hazard';
          const isGolden = target.type === 'golden';
          const isFreeze = target.type === 'freeze';
          const isSurge = target.type === 'surge';

          return (
            <div
              key={target.id}
              id={`pulse-target-${target.id}`}
              style={{
                left: `${target.x}%`,
                top: `${target.y}%`,
              }}
              onTouchStart={(e) => handleTargetTap(target, e)}
              onMouseDown={(e) => handleTargetTap(target, e)}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-20 h-20 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
            >
              {/* Outer Collapsing Ring */}
              <div
                style={{
                  animationDuration: `${target.duration}ms`,
                  borderColor: target.color,
                }}
                className="absolute inset-0 rounded-full border-2 opacity-85 animate-ping pointer-events-none"
              />

              {/* Secondary timing guide ring */}
              <div
                style={{
                  animationDuration: `${target.duration}ms`,
                  borderColor: target.color,
                }}
                className="absolute inset-2 rounded-full border border-dashed opacity-60 animate-spin pointer-events-none"
              />

              {/* Core Touch Sphere */}
              <div
                style={{
                  backgroundColor: isHazard ? '#ef4444' : isGolden ? '#f59e0b' : isFreeze ? '#06b6d4' : isSurge ? '#8b5cf6' : '#0284c7',
                  boxShadow: `0 0 16px ${target.color}`,
                }}
                className="w-12 h-12 rounded-full flex items-center justify-center font-black text-slate-950 text-xs shadow-lg transition transform"
              >
                {isHazard ? (
                  <Zap className="w-5 h-5 text-white fill-white animate-bounce" />
                ) : isGolden ? (
                  <Flame className="w-5 h-5 text-slate-950 fill-slate-950" />
                ) : isFreeze ? (
                  <span className="text-white font-mono text-[10px] font-bold">SLO</span>
                ) : isSurge ? (
                  <Shield className="w-5 h-5 text-white fill-white" />
                ) : (
                  <span className="text-white font-mono font-bold text-sm">TAP</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Countdown Overlay */}
        {gameState === 'countdown' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-30">
            <div className="text-7xl font-black text-cyan-400 font-mono animate-bounce">
              {countdown > 0 ? countdown : 'GO!'}
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-300 uppercase tracking-widest">
              {t.play_solo}
            </p>
          </div>
        )}

        {/* Paused Overlay */}
        {gameState === 'paused' && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center z-30 p-6">
            <h3 className="text-2xl font-black text-slate-100 mb-6 tracking-wide">PAUSED</h3>
            <div className="space-y-3 w-48">
              <button
                onClick={() => setGameState('playing')}
                className="w-full py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 hover:bg-cyan-400"
              >
                <Play className="w-4 h-4" /> Resume
              </button>
              <button
                onClick={onBackToMenu}
                className="w-full py-3 rounded-xl bg-slate-800 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-700"
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

              <div className="text-3xl font-black font-mono text-cyan-400 mb-4">
                {score.toLocaleString()}
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
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Perfect Taps</span>
                  <span className="text-base font-mono font-bold text-cyan-300">{perfectCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">{t.avg_reaction}</span>
                  <span className="text-base font-mono font-bold text-purple-300">
                    {reactionTimes.length > 0 
                      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length) 
                      : 210} ms
                  </span>
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
