import React, { useState } from 'react';
import { Volume2, VolumeX, Moon, Sun, Globe, Bell, User, Zap, Sparkles, Music } from 'lucide-react';
import { UserProfile, Language } from '../types';
import { translations } from '../i18n/translations';
import { soundEngine } from '../services/audio';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  profile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onOpenProfile: () => void;
  onOpenEvents: () => void;
  onOpenTutorial: () => void;
  hasUnreadEvents?: boolean;
}

const languages: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
];

export const Header: React.FC<HeaderProps> = ({
  profile,
  onUpdateProfile,
  onOpenProfile,
  onOpenEvents,
  onOpenTutorial,
  hasUnreadEvents = true,
}) => {
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const t = translations[profile.language] || translations.en;

  const toggleAudio = () => {
    const nextState = !profile.soundEnabled;
    soundEngine.setEnabled(nextState);
    onUpdateProfile({ soundEnabled: nextState });
    if (nextState) soundEngine.playTap('GOOD');
  };

  const toggleMusic = () => {
    const nextState = !(profile.musicEnabled ?? true);
    soundEngine.setMusicEnabled(nextState);
    onUpdateProfile({ musicEnabled: nextState });
    soundEngine.playTap('GOOD');
  };

  const toggleTheme = () => {
    const nextTheme = profile.theme === 'dark' ? 'light' : 'dark';
    onUpdateProfile({ theme: nextTheme });
    soundEngine.playTap();
  };

  const handleSelectLang = (code: Language) => {
    onUpdateProfile({ language: code });
    setLangMenuOpen(false);
    soundEngine.playTap();
  };

  const isDark = profile.theme === 'dark';

  return (
    <header
      id="app-header"
      className={`w-full sticky top-0 z-30 transition-colors duration-300 border-b ${
        isDark
          ? 'bg-slate-950/85 border-slate-800/80 backdrop-blur-md text-slate-100'
          : 'bg-white/90 border-slate-200 backdrop-blur-md text-slate-800 shadow-sm'
      }`}
    >
      <div className="max-w-4xl mx-auto px-3.5 py-2.5 flex items-center justify-between gap-2">
        {/* Logo and Brand */}
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-fuchsia-500 p-0.5 flex items-center justify-center shadow-sm">
            <div className={`w-full h-full rounded-[10px] flex items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
              <Zap className="w-4 h-4 text-cyan-400 fill-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight leading-none flex items-center gap-1.5">
              <span>{t.app_title}</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                PRO
              </span>
            </h1>
            <p className="text-[10px] font-medium text-slate-400 line-clamp-1">
              {t.tagline}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* PWA Install Button */}
          <div className="hidden xs:block sm:block">
            <PWAInstallButton />
          </div>

          {/* Sound Toggle */}
          <button
            id="header-sound-btn"
            onClick={toggleAudio}
            className={`p-2 rounded-xl transition ${
              isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
            }`}
            title={profile.soundEnabled ? 'Mute SFX' : 'Unmute SFX'}
            aria-label="Toggle Sound Effects"
          >
            {profile.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* Soft Background Music Toggle */}
          <button
            id="header-music-btn"
            onClick={toggleMusic}
            className={`p-2 rounded-xl transition ${
              isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
            }`}
            title={(profile.musicEnabled ?? true) ? 'Mute Ambient Music' : 'Play Gentle Ambient Music'}
            aria-label="Toggle Background Music"
          >
            <Music
              className={`w-4 h-4 transition-colors ${
                (profile.musicEnabled ?? true) ? 'text-fuchsia-400' : 'text-slate-500'
              }`}
            />
          </button>

          {/* Dark/Light Mode Toggle */}
          <button
            id="header-theme-btn"
            onClick={toggleTheme}
            className={`p-2 rounded-xl transition ${
              isDark ? 'hover:bg-slate-800 text-amber-400' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title={isDark ? t.light_mode : t.dark_mode}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Language Selector */}
          <div className="relative">
            <button
              id="header-lang-btn"
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className={`p-2 rounded-xl flex items-center gap-1 transition ${
                isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
              }`}
              title="Select Language"
              aria-label="Select Language"
            >
              <Globe className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-mono font-bold uppercase">{profile.language}</span>
            </button>

            {langMenuOpen && (
              <div
                className={`absolute right-0 mt-2 w-36 rounded-xl border p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 ${
                  isDark
                    ? 'bg-slate-900 border-slate-800 text-slate-100'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleSelectLang(lang.code)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                      profile.language === lang.code
                        ? 'bg-cyan-500/20 text-cyan-400 font-bold'
                        : isDark
                        ? 'hover:bg-slate-800 text-slate-300'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </span>
                    {profile.language === lang.code && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Events & Notifications */}
          <button
            id="header-events-btn"
            onClick={onOpenEvents}
            className={`relative p-2 rounded-xl transition ${
              isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
            }`}
            title={t.events}
            aria-label="Events and Push Notifications"
          >
            <Bell className="w-4 h-4 text-fuchsia-400" />
            {hasUnreadEvents && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-fuchsia-500 animate-ping" />
            )}
          </button>

          {/* User Profile & Level */}
          <button
            id="header-profile-btn"
            onClick={onOpenProfile}
            className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-xl border transition ${
              isDark
                ? 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-200'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800'
            }`}
            title="Profile & Cloud Sync"
          >
            <span className="text-sm">{profile.avatar}</span>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[11px] font-bold max-w-[70px] truncate">{profile.username}</span>
              <span className="text-[9px] font-mono text-cyan-400 font-bold">Lv.{profile.level}</span>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
