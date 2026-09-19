import React, { useState } from 'react';
import { X, User, Cloud, RefreshCw, Copy, Check, ShieldCheck, Trophy, Sparkles, DownloadCloud, Volume2, Music } from 'lucide-react';
import { UserProfile } from '../types';
import { translations } from '../i18n/translations';
import { backupToCloud, restoreFromCloud } from '../services/storage';
import { soundEngine, triggerHaptic } from '../services/audio';

interface ProfileModalProps {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
}

const AVATARS = ['⚡', '👑', '🎯', '🦊', '⚔️', '🚀', '👻', '⏱️', '🌸', '🐉', '💎', '🔥'];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  profile,
  isOpen,
  onClose,
  onUpdateProfile,
}) => {
  const t = translations[profile.language] || translations.en;
  const isDark = profile.theme === 'dark';

  const [usernameInput, setUsernameInput] = useState(profile.username);
  const [selectedAvatar, setSelectedAvatar] = useState(profile.avatar);
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const handleSaveProfile = () => {
    soundEngine.playTap();
    onUpdateProfile({
      username: usernameInput.trim() || 'Player',
      avatar: selectedAvatar,
    });
    setSyncStatus('Profile saved locally!');
  };

  const handleCloudBackup = async () => {
    setIsSyncing(true);
    setSyncStatus('Uploading progress to secure cloud...');
    soundEngine.playTap();

    const res = await backupToCloud(profile);
    setIsSyncing(false);

    if (res.success) {
      soundEngine.playVictory();
      triggerHaptic('success');
      onUpdateProfile({
        syncCode: res.syncCode,
        lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      setSyncStatus(`${t.sync_success} ${res.syncCode}`);
    } else {
      setSyncStatus(res.message);
    }
  };

  const handleCloudRestore = async () => {
    if (!syncCodeInput.trim()) return;
    setIsSyncing(true);
    setSyncStatus('Fetching cloud data...');
    soundEngine.playTap();

    const res = await restoreFromCloud(syncCodeInput.trim());
    setIsSyncing(false);

    if (res.success && res.profile) {
      soundEngine.playVictory();
      triggerHaptic('success');
      onUpdateProfile(res.profile);
      setUsernameInput(res.profile.username);
      setSelectedAvatar(res.profile.avatar);
      setSyncStatus(t.restore_success);
    } else {
      soundEngine.playMiss();
      triggerHaptic('error');
      setSyncStatus(res.message || t.restore_error);
    }
  };

  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(profile.syncCode);
      setCopiedCode(true);
      soundEngine.playTap();
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const xpForNextLevel = 1000;
  const currentLevelXp = profile.xp % xpForNextLevel;
  const xpPct = Math.min(100, Math.round((currentLevelXp / xpForNextLevel) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl overflow-y-auto max-h-[90vh] ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-black tracking-tight">{t.profile}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Avatar Picker & Handle */}
        <div className="flex flex-col items-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-3xl shadow-lg mb-2">
            {selectedAvatar}
          </div>

          <div className="flex flex-wrap justify-center gap-1.5 max-w-[280px] mb-3">
            {AVATARS.map((av) => (
              <button
                key={av}
                onClick={() => { setSelectedAvatar(av); soundEngine.playTap(); }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition ${
                  selectedAvatar === av
                    ? 'bg-cyan-500/30 border border-cyan-400 scale-110'
                    : 'bg-slate-800/60 hover:bg-slate-800'
                }`}
              >
                {av}
              </button>
            ))}
          </div>

          <div className="w-full flex items-center gap-2">
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Player Handle"
              maxLength={16}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={handleSaveProfile}
              className="py-2 px-3 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition active:scale-95"
            >
              Save
            </button>
          </div>
        </div>

        {/* Level Progression & High Scores */}
        <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold flex items-center gap-1.5 text-cyan-400">
              <Sparkles className="w-3.5 h-3.5" /> Level {profile.level}
            </span>
            <span className="font-mono text-slate-400 text-[10px]">
              {currentLevelXp} / {xpForNextLevel} XP
            </span>
          </div>

          <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div style={{ width: `${xpPct}%` }} className="h-full bg-cyan-400 transition-all duration-300" />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2 rounded-lg bg-slate-900/60 text-center">
              <span className="text-[10px] text-slate-400 font-bold block">{t.high_score}</span>
              <span className="font-mono font-black text-amber-400 text-sm">{profile.highScore.toLocaleString()}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/60 text-center">
              <span className="text-[10px] text-slate-400 font-bold block">{t.combo_max}</span>
              <span className="font-mono font-black text-cyan-300 text-sm">{profile.bestCombo || 0}x</span>
            </div>
          </div>
        </div>

        {/* Audio & Music Controls */}
        <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 mb-4 space-y-2.5">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> Audio & Sound
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                const next = !profile.soundEnabled;
                soundEngine.setEnabled(next);
                onUpdateProfile({ soundEnabled: next });
                if (next) soundEngine.playTap('GOOD');
              }}
              className={`p-2 rounded-lg flex items-center justify-between border transition text-xs font-bold ${
                profile.soundEnabled
                  ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-900/60 border-slate-800 text-slate-500'
              }`}
            >
              <span>SFX</span>
              <span>{profile.soundEnabled ? 'ON' : 'OFF'}</span>
            </button>
            <button
              onClick={() => {
                const next = !(profile.musicEnabled ?? true);
                soundEngine.setMusicEnabled(next);
                onUpdateProfile({ musicEnabled: next });
                soundEngine.playTap('GOOD');
              }}
              className={`p-2 rounded-lg flex items-center justify-between border transition text-xs font-bold ${
                (profile.musicEnabled ?? true)
                  ? 'bg-fuchsia-950/40 border-fuchsia-500/40 text-fuchsia-300'
                  : 'bg-slate-900/60 border-slate-800 text-slate-500'
              }`}
            >
              <span className="flex items-center gap-1">
                <Music className="w-3 h-3" /> Gentle Music
              </span>
              <span>{(profile.musicEnabled ?? true) ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Secure Cloud Sync Section */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-950/30 via-slate-900 to-slate-900 border border-blue-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-blue-400" /> Secure Cloud Sync
            </span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Encrypted
            </span>
          </div>

          {/* User's Cloud Sync Code */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
            <div>
              <span className="text-[9px] text-slate-400 uppercase font-bold block">Your Sync Code</span>
              <span className="text-sm font-black font-mono tracking-wider text-cyan-400">
                {profile.syncCode}
              </span>
            </div>
            <button
              onClick={handleCopyCode}
              className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
              title="Copy Code"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Backup Button */}
          <button
            onClick={handleCloudBackup}
            disabled={isSyncing}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-500 active:scale-95 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{t.sync_now}</span>
          </button>

          {/* Restore from Code on other phone/device */}
          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[10px] text-slate-400 font-bold block mb-1.5">
              Transfer to Another Device
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={syncCodeInput}
                onChange={(e) => setSyncCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. HP-8924"
                maxLength={10}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-white uppercase focus:outline-none focus:border-cyan-400"
              />
              <button
                onClick={handleCloudRestore}
                disabled={isSyncing || !syncCodeInput.trim()}
                className="py-1.5 px-3 rounded-lg bg-slate-700 text-white font-bold text-xs hover:bg-slate-600 transition disabled:opacity-40"
              >
                Restore
              </button>
            </div>
          </div>

          {/* Status Message */}
          {syncStatus && (
            <div className="text-[11px] text-center font-medium text-cyan-300 py-1 bg-cyan-950/30 rounded-lg border border-cyan-900/50">
              {syncStatus}
            </div>
          )}

          {profile.lastSyncedAt && (
            <div className="text-[9px] text-center text-slate-500 font-mono">
              Last synced: {profile.lastSyncedAt}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
