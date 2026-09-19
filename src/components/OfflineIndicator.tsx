import React from 'react';
import { WifiOff, Cloud } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getQueuedOfflineSync } from '../services/storage';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const hasQueuedSync = !isOnline && Boolean(getQueuedOfflineSync());

  if (isOnline) return null;

  return (
    <div
      id="offline-status-banner"
      className="fixed bottom-4 left-4 right-4 max-w-sm mx-auto z-40 flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-amber-500/90 text-slate-950 font-medium text-xs shadow-lg backdrop-blur-md animate-bounce"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 flex-shrink-0" />
        <span>Offline Mode — Full gameplay active</span>
      </div>
      {hasQueuedSync && (
        <span className="flex items-center gap-1 bg-slate-900/80 text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-semibold">
          <Cloud className="w-3 h-3" /> Queued
        </span>
      )}
    </div>
  );
};
