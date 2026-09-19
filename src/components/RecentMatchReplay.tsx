import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  SkipBack, 
  Zap, 
  Target, 
  Flame, 
  Swords, 
  Trophy, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Activity,
  Gauge
} from 'lucide-react';
import { MatchAnalytics, ReplayEvent, UserProfile } from '../types';
import { soundEngine, triggerHaptic } from '../services/audio';

interface RecentMatchReplayProps {
  matches: MatchAnalytics[];
  profile: UserProfile;
}

export const RecentMatchReplay: React.FC<RecentMatchReplayProps> = ({ matches, profile }) => {
  const isDark = profile.theme === 'dark';

  // Filter available matches
  const soloMatches = matches.filter(m => m.mode === 'solo');
  const duelMatches = matches.filter(m => m.mode === 'duel');

  const [selectedMode, setSelectedMode] = useState<'latest' | 'solo' | 'duel'>('latest');
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');

  // Active match determined by mode or selected match
  const activeMatch = React.useMemo(() => {
    if (selectedMatchId) {
      const found = matches.find(m => m.id === selectedMatchId);
      if (found) return found;
    }
    if (selectedMode === 'solo' && soloMatches.length > 0) return soloMatches[0];
    if (selectedMode === 'duel' && duelMatches.length > 0) return duelMatches[0];
    return matches[0] || null;
  }, [matches, selectedMode, selectedMatchId, soloMatches, duelMatches]);

  // Replay playback states
  const events = activeMatch?.events || [];
  const durationMs = Math.max(
    (activeMatch?.durationSeconds || 30) * 1000,
    events.length > 0 ? Math.max(...events.map(e => e.timestampMs)) + 1200 : 30000
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const [showEventLog, setShowEventLog] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);

  // Reset playback when active match changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTimeMs(0);
  }, [activeMatch?.id]);

  // Playback animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    lastTickTimeRef.current = performance.now();

    const loop = (now: number) => {
      const delta = (now - lastTickTimeRef.current) * playbackSpeed;
      lastTickTimeRef.current = now;

      setCurrentTimeMs(prev => {
        const next = prev + delta;
        if (next >= durationMs) {
          setIsPlaying(false);
          return durationMs;
        }
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, durationMs]);

  if (!activeMatch) {
    return (
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center py-8">
        <Activity className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <p className="text-xs font-semibold text-slate-400">No match records available yet.</p>
        <p className="text-[10px] text-slate-500 mt-1">Play a Solo or Duel match to view your performance replay!</p>
      </div>
    );
  }

  // Active events at current time
  const pastEvents = events.filter(e => e.timestampMs <= currentTimeMs);
  const currentEvent = pastEvents[pastEvents.length - 1] || null;

  // Active visible target in simulation arena (recent event within 900ms window)
  const activeArenaEvents = events.filter(
    e => e.timestampMs <= currentTimeMs && currentTimeMs - e.timestampMs < 950
  );

  // Reaction rating tier for this specific match
  const reactionTier = activeMatch.avgReactionTimeMs < 200
    ? { title: "Apex Reflex (Godlike)", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" }
    : activeMatch.avgReactionTimeMs < 235
    ? { title: "Lightning Fast", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/30" }
    : activeMatch.avgReactionTimeMs < 280
    ? { title: "Swift Reaction", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" }
    : { title: "Standard Reflex", color: "text-slate-300", bg: "bg-slate-800 border-slate-700" };

  // Accuracy rank
  const accuracyRank = activeMatch.accuracy >= 98
    ? { rank: 'S+', title: 'Master Precision', color: 'text-amber-300' }
    : activeMatch.accuracy >= 94
    ? { rank: 'S', title: 'Flawless Timing', color: 'text-emerald-400' }
    : activeMatch.accuracy >= 88
    ? { rank: 'A', title: 'High Sharpness', color: 'text-cyan-400' }
    : { rank: 'B', title: 'Solid Execution', color: 'text-blue-400' };

  // Step controls
  const handleStepBack = () => {
    setIsPlaying(false);
    const prev = events.filter(e => e.timestampMs < currentTimeMs - 100);
    const target = prev[prev.length - 1];
    setCurrentTimeMs(target ? Math.max(0, target.timestampMs - 50) : 0);
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    const next = events.find(e => e.timestampMs > currentTimeMs + 100);
    if (next) {
      setCurrentTimeMs(next.timestampMs);
    } else {
      setCurrentTimeMs(durationMs);
    }
  };

  const handleRestart = () => {
    setIsPlaying(false);
    setCurrentTimeMs(0);
  };

  const handlePlayToggle = () => {
    if (currentTimeMs >= durationMs) {
      setCurrentTimeMs(0);
    }
    soundEngine.playTap();
    triggerHaptic('tap');
    setIsPlaying(!isPlaying);
  };

  // Running stats in playback
  const runningHits = pastEvents.filter(e => e.type === 'hit' || e.type === 'powerup').length;
  const runningMisses = pastEvents.filter(e => e.type === 'miss' || e.type === 'hazard').length;
  const runningTotal = runningHits + runningMisses;
  const runningAccuracy = runningTotal > 0 ? Math.round((runningHits / runningTotal) * 100) : 100;

  return (
    <div
      id="recent-match-replay-container"
      className="p-4 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-cyan-500/30 shadow-xl relative overflow-hidden"
    >
      {/* Glow Accent */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Mode Switcher */}
      <div className="relative z-10 flex flex-col gap-2.5 mb-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                Recent Match Replay
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 font-mono font-bold">
                  TELEMETRY
                </span>
              </h3>
              <span className="text-[11px] text-slate-400">
                {activeMatch.date} • {activeMatch.durationSeconds || Math.round(durationMs / 1000)}s duration
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {activeMatch.peakDynamicDifficulty && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border bg-purple-500/20 text-purple-300 border-purple-500/40 font-mono">
                ⚡ {activeMatch.peakDynamicDifficulty.toFixed(2)}x PACE
              </span>
            )}
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                activeMatch.mode === 'duel'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              }`}
            >
              {activeMatch.mode === 'duel' ? '1v1 Duel' : 'Solo Rush'}
            </span>
          </div>
        </div>

        {/* Solo vs Duel Switcher */}
        <div className="grid grid-cols-3 gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          <button
            id="replay-select-latest"
            onClick={() => {
              setSelectedMode('latest');
              setSelectedMatchId('');
              soundEngine.playTap();
            }}
            className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
              selectedMode === 'latest'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3 h-3" /> Latest
          </button>
          <button
            id="replay-select-solo"
            disabled={soloMatches.length === 0}
            onClick={() => {
              setSelectedMode('solo');
              setSelectedMatchId(soloMatches[0]?.id || '');
              soundEngine.playTap();
            }}
            className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
              selectedMode === 'solo'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200 disabled:opacity-40'
            }`}
          >
            <Zap className="w-3 h-3" /> Solo ({soloMatches.length})
          </button>
          <button
            id="replay-select-duel"
            disabled={duelMatches.length === 0}
            onClick={() => {
              setSelectedMode('duel');
              setSelectedMatchId(duelMatches[0]?.id || '');
              soundEngine.playTap();
            }}
            className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
              selectedMode === 'duel'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200 disabled:opacity-40'
            }`}
          >
            <Swords className="w-3 h-3" /> Duel ({duelMatches.length})
          </button>
        </div>
      </div>

      {/* KEY PERFORMANCE METRIC HERO HIGHLIGHTS: ACCURACY & REACTION TIME */}
      <div className="relative z-10 grid grid-cols-2 gap-2.5 mb-3.5">
        {/* REACTION TIME HERO */}
        <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-cyan-400" /> Reaction Speed
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${reactionTier.bg} ${reactionTier.color}`}>
              {reactionTier.title}
            </span>
          </div>

          <div className="my-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black font-mono text-cyan-400">
                {activeMatch.avgReactionTimeMs}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">ms avg</span>
            </div>
            {activeMatch.fastestReactionMs && (
              <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                <span>Peak speed:</span>
                <span className="font-mono font-bold">{activeMatch.fastestReactionMs}ms</span>
              </div>
            )}
          </div>

          <div className="text-[9px] text-slate-400 leading-tight pt-1.5 border-t border-slate-800/80">
            {activeMatch.avgReactionTimeMs < 250 ? '⚡ Faster than 92% of humans' : '⏱️ Steadily locked rhythm'}
          </div>
        </div>

        {/* ACCURACY HERO */}
        <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Target className="w-3 h-3 text-emerald-400" /> Precision Accuracy
            </span>
            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 ${accuracyRank.color}`}>
              {accuracyRank.rank} Tier
            </span>
          </div>

          <div className="my-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black font-mono text-emerald-400">
                {activeMatch.accuracy}%
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">acc</span>
            </div>
            <div className="text-[11px] font-semibold text-amber-300 flex items-center gap-1 mt-0.5">
              <Flame className="w-3 h-3 fill-amber-400" />
              <span>Max Combo:</span>
              <span className="font-mono font-bold">{activeMatch.maxCombo}x</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80">
            <span className="text-emerald-400 font-bold">{activeMatch.perfectHits} Perfect</span>
            <span className="text-cyan-400 font-bold">{activeMatch.greatHits} Great</span>
            <span className="text-rose-400 font-bold">{activeMatch.misses} Miss</span>
          </div>
        </div>
      </div>

      {/* DUEL MATCH BREAKDOWN (if mode is duel) */}
      {activeMatch.mode === 'duel' && activeMatch.duelDetails && (
        <div className="relative z-10 mb-3.5 p-3 rounded-2xl bg-slate-950/80 border border-purple-500/30 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-cyan-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              {activeMatch.duelDetails.player1Name}
            </span>
            <span className="text-xs font-mono font-black text-slate-300">
              {activeMatch.duelDetails.p1Score} - {activeMatch.duelDetails.p2Score}
            </span>
            <span className="text-rose-400 flex items-center gap-1">
              {activeMatch.duelDetails.player2Name}
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            </span>
          </div>

          {/* Side by side stats */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1 border-t border-slate-800">
            <div className="text-left space-y-0.5 text-cyan-300">
              <div>Acc: <span className="font-bold text-white">{activeMatch.duelDetails.p1Accuracy ?? activeMatch.accuracy}%</span></div>
              <div>Avg Speed: <span className="font-bold text-white">{activeMatch.duelDetails.p1AvgReactionMs ?? activeMatch.avgReactionTimeMs}ms</span></div>
            </div>
            <div className="text-right space-y-0.5 text-rose-300">
              <div>Acc: <span className="font-bold text-white">{activeMatch.duelDetails.p2Accuracy ?? 88}%</span></div>
              <div>Avg Speed: <span className="font-bold text-white">{activeMatch.duelDetails.p2AvgReactionMs ?? 245}ms</span></div>
            </div>
          </div>

          {activeMatch.winner && (
            <div className="text-center text-[11px] font-bold text-amber-300 bg-amber-500/10 py-1 rounded-lg border border-amber-500/20">
              🏆 Winner: {activeMatch.winner}
            </div>
          )}
        </div>
      )}

      {/* INTERACTIVE REPLAY SIMULATION ARENA */}
      <div className="relative z-10 mb-3 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
        {/* Arena Top Status Bar */}
        <div className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
            <span className="text-slate-300 font-bold">
              {Math.floor(currentTimeMs / 1000)}s / {Math.floor(durationMs / 1000)}s
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-emerald-400 font-bold">
              {runningAccuracy}% Acc
            </span>
            <span className="text-cyan-400 font-bold">
              {currentEvent?.reactionTimeMs ? `${currentEvent.reactionTimeMs}ms` : '--'}
            </span>
            {currentEvent?.combo ? (
              <span className="text-amber-400 font-bold">
                {currentEvent.combo}x
              </span>
            ) : null}
          </div>
        </div>

        {/* 2D Mini Simulation Canvas Arena */}
        <div className="relative w-full h-44 bg-slate-950 overflow-hidden flex items-center justify-center">
          {/* Subtle Cyber Grid Background */}
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Duel divider if duel mode */}
          {activeMatch.mode === 'duel' && (
            <div className="absolute inset-y-0 left-1/2 w-0.5 bg-dashed border-r border-slate-700/60 flex items-center justify-center">
              <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-1 rotate-90">
                SPLIT DUEL
              </span>
            </div>
          )}

          {/* Active replay targets rendered at accurate (x,y) coordinates */}
          {activeArenaEvents.map(event => {
            const ageMs = currentTimeMs - event.timestampMs;
            const isHit = event.type === 'hit' || event.type === 'powerup' || event.type === 'sabotage';
            const isMiss = event.type === 'miss' || event.type === 'hazard';

            return (
              <div
                key={event.id}
                className="absolute pointer-events-none transition-transform duration-100 flex flex-col items-center justify-center"
                style={{
                  left: `${event.x}%`,
                  top: `${event.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {/* Target Circle with Ripple */}
                <div
                  className={`relative w-8 h-8 rounded-full flex items-center justify-center font-mono font-black text-[9px] shadow-lg ${
                    isHit
                      ? 'bg-cyan-500 text-slate-950 ring-4 ring-cyan-400/40 animate-pulse'
                      : 'bg-rose-500 text-white ring-4 ring-rose-500/40'
                  }`}
                  style={{ backgroundColor: event.color }}
                >
                  {event.reactionTimeMs ? `${event.reactionTimeMs}` : 'HIT'}

                  {/* Expanding Shockwave Ring */}
                  <span
                    className="absolute inset-0 rounded-full border-2 border-current animate-ping opacity-60 pointer-events-none"
                  />
                </div>

                {/* Floating Grade Badge */}
                <div
                  className={`mt-1 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider whitespace-nowrap shadow-md ${
                    event.grade === 'PERFECT'
                      ? 'bg-emerald-500 text-slate-950'
                      : event.grade === 'GREAT'
                      ? 'bg-cyan-500 text-slate-950'
                      : event.grade === 'MISS'
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-500 text-slate-950'
                  }`}
                >
                  {event.label || event.grade}
                </div>
              </div>
            );
          })}

          {/* Empty State / Standby Indicator */}
          {activeArenaEvents.length === 0 && (
            <div className="text-center select-none text-slate-600">
              <Gauge className="w-6 h-6 mx-auto mb-1 opacity-40" />
              <span className="text-[11px] font-mono">
                {isPlaying ? 'Awaiting next tap event...' : 'Press Play to watch precision replay'}
              </span>
            </div>
          )}
        </div>

        {/* Scrubbable Timeline Track */}
        <div className="p-3 bg-slate-900/60 border-t border-slate-800">
          <div className="relative w-full h-3 bg-slate-800 rounded-full cursor-pointer overflow-hidden flex items-center">
            {/* Event Markers along Timeline */}
            {events.map(e => {
              const posPct = (e.timestampMs / durationMs) * 100;
              const isMiss = e.type === 'miss' || e.type === 'hazard';
              return (
                <div
                  key={e.id}
                  className={`absolute top-0 bottom-0 w-1 rounded-full pointer-events-none opacity-80 ${
                    isMiss ? 'bg-rose-500 z-10' : e.grade === 'PERFECT' ? 'bg-emerald-400' : 'bg-cyan-400'
                  }`}
                  style={{ left: `${posPct}%` }}
                />
              );
            })}

            {/* Filled Progress Bar */}
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-75"
              style={{ width: `${(currentTimeMs / durationMs) * 100}%` }}
            />
          </div>

          {/* Native Slider for Accessible Scrubbing */}
          <input
            id="replay-timeline-slider"
            type="range"
            min="0"
            max={durationMs}
            value={currentTimeMs}
            onChange={e => {
              setIsPlaying(false);
              setCurrentTimeMs(Number(e.target.value));
            }}
            className="w-full -mt-2.5 h-3 opacity-0 cursor-pointer"
          />

          {/* Replay Controls & Speed Bar */}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5">
              <button
                id="replay-restart-btn"
                onClick={handleRestart}
                title="Restart"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                id="replay-step-back-btn"
                onClick={handleStepBack}
                title="Step backward"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                id="replay-play-pause-btn"
                onClick={handlePlayToggle}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-1 active:scale-95 shadow-md shadow-cyan-500/20 transition"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-slate-950" /> : <Play className="w-3.5 h-3.5 fill-slate-950" />}
                <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
              </button>
              <button
                id="replay-step-fwd-btn"
                onClick={handleStepForward}
                title="Step forward"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Playback speed selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              {([1, 2, 4] as const).map(speed => (
                <button
                  key={speed}
                  id={`replay-speed-${speed}x`}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                    playbackSpeed === speed
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Keyframe Telemetry Log */}
      <div className="relative z-10">
        <button
          id="toggle-event-log-btn"
          onClick={() => setShowEventLog(!showEventLog)}
          className="w-full py-2 px-3 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-between text-xs font-bold transition"
        >
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" /> Tap Telemetry Log ({events.length} keyframes)
          </span>
          <span className="text-[10px] font-mono text-cyan-400">
            {showEventLog ? 'Hide' : 'Inspect All Taps'}
          </span>
        </button>

        {showEventLog && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-xl bg-slate-950 border border-slate-800 p-2 divide-y divide-slate-850 text-xs font-mono">
            {events.map((ev, idx) => {
              const isSelected = Math.abs(ev.timestampMs - currentTimeMs) < 400;
              return (
                <div
                  key={ev.id}
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentTimeMs(ev.timestampMs);
                  }}
                  className={`py-1.5 px-2 flex items-center justify-between cursor-pointer rounded transition ${
                    isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'hover:bg-slate-900 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[10px]">#{idx + 1}</span>
                    <span className="text-[10px] font-bold">
                      {(ev.timestampMs / 1000).toFixed(1)}s
                    </span>
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                        ev.grade === 'PERFECT'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : ev.grade === 'GREAT'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : ev.grade === 'MISS'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {ev.label || ev.grade}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {ev.reactionTimeMs && (
                      <span className="font-bold text-slate-300 text-[10px]">
                        {ev.reactionTimeMs}ms
                      </span>
                    )}
                    {ev.combo ? (
                      <span className="text-amber-400 text-[10px]">
                        {ev.combo}x
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
