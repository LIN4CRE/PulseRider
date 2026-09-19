import React, { useState, useEffect } from 'react';
import { X, Bell, BellRing, Calendar, Trophy, Zap, Clock, Check, Send } from 'lucide-react';
import { UserProfile, UpcomingEvent } from '../types';
import { translations } from '../i18n/translations';
import {
  requestNotificationPermission,
  isNotificationGranted,
  sendPushNotification,
  triggerEventReminder,
} from '../services/notifications';
import { soundEngine, triggerHaptic } from '../services/audio';

interface EventsModalProps {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

export const EventsModal: React.FC<EventsModalProps> = ({
  profile,
  isOpen,
  onClose,
}) => {
  const t = translations[profile.language] || translations.en;
  const isDark = profile.theme === 'dark';

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [remindedEvents, setRemindedEvents] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setNotificationsEnabled(isNotificationGranted());
    fetchEvents();
  }, [isOpen]);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (e) {
      // Fallback default events
      setEvents([
        {
          id: 'ev-1',
          title: 'HyperPulse Global Blitz Cup',
          description: 'Compete in 60s reflex rushes for exclusive neon champion badge & 5,000 XP!',
          startTime: 'Tonight @ 8:00 PM',
          duration: '2 Hours',
          reward: '5,000 XP + Neon Badge',
          active: true,
        },
        {
          id: 'ev-2',
          title: 'Weekend Local Duel Championship',
          description: 'Win 3 head-to-head local duel battles to unlock the Twin Blades title.',
          startTime: 'Saturday @ 12:00 PM',
          duration: '24 Hours',
          reward: '3,000 XP + Saber Avatar',
          active: false,
        },
      ]);
    }
  };

  const handleToggleNotifications = async () => {
    soundEngine.playTap();
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      setNotificationsEnabled(granted);
      if (granted) {
        soundEngine.playVictory();
        triggerHaptic('success');
        sendPushNotification('⚡ HyperPulse Notifications Activated!', {
          body: 'You will receive alerts for tournaments, daily challenge resets, and rival duels.',
        });
        setFeedback('Push notifications activated!');
      } else {
        setFeedback('Notification permission was blocked or dismissed in browser.');
      }
    }
  };

  const handleRemindMe = (event: UpcomingEvent) => {
    soundEngine.playTap();
    triggerHaptic('tap');
    setRemindedEvents(prev => ({ ...prev, [event.id]: true }));

    if (notificationsEnabled) {
      triggerEventReminder(event.title, '30 minutes');
      setFeedback(`Reminder set for "${event.title}"!`);
    } else {
      setFeedback(`Reminder saved! Enable notifications above to get alerts on your device lock screen.`);
    }
  };

  const handleSendTestPush = () => {
    soundEngine.playTap();
    if (!notificationsEnabled) {
      handleToggleNotifications();
      return;
    }
    sendPushNotification('⚡ HyperPulse Test Alert', {
      body: 'Push notification engine is firing on all cylinders! Next tournament begins soon.',
    });
    setFeedback('Test notification sent to device notification center!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl overflow-y-auto max-h-[90vh] ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-fuchsia-400" />
            <h3 className="text-base font-black tracking-tight">{t.events}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Push Notification Activation Card */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-fuchsia-950/40 to-slate-900 border border-fuchsia-900/40 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-fuchsia-400" />
              <div>
                <span className="text-xs font-bold block text-slate-200">
                  {t.push_notifications}
                </span>
                <span className="text-[10px] text-slate-400">
                  {notificationsEnabled ? 'Active & Receiving Alerts' : 'Alert me when events begin'}
                </span>
              </div>
            </div>

            <button
              onClick={handleToggleNotifications}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                notificationsEnabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-fuchsia-500 text-slate-950 font-bold hover:bg-fuchsia-400'
              }`}
            >
              {notificationsEnabled ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Enabled
                </>
              ) : (
                <span>Enable</span>
              )}
            </button>
          </div>

          {notificationsEnabled && (
            <button
              onClick={handleSendTestPush}
              className="mt-2.5 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <Send className="w-3 h-3" /> Send Test Push Alert
            </button>
          )}
        </div>

        {feedback && (
          <div className="mb-3 text-[11px] text-center font-medium text-fuchsia-300 py-1 px-2 bg-fuchsia-950/30 rounded-lg border border-fuchsia-900/50">
            {feedback}
          </div>
        )}

        {/* Upcoming Events List */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Upcoming Tournaments
          </span>

          {events.map((ev) => {
            const hasReminded = remindedEvents[ev.id];

            return (
              <div
                key={ev.id}
                className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                      <span>{ev.title}</span>
                      {ev.active && (
                        <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 text-[9px] font-black border border-rose-500/30 animate-pulse">
                          LIVE
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      {ev.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-700/40">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{ev.startTime}</span>
                  </div>

                  <button
                    onClick={() => handleRemindMe(ev)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                      hasReminded
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    }`}
                  >
                    {hasReminded ? (
                      <>
                        <Check className="w-3 h-3" /> Reminded
                      </>
                    ) : (
                      <>
                        <Bell className="w-3 h-3" /> Remind Me
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-medium">
                  <Trophy className="w-3 h-3" /> Reward: {ev.reward}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
