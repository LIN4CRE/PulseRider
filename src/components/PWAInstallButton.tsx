import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        id="pwa-install-btn"
        onClick={install}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 text-xs font-semibold hover:bg-cyan-500/30 transition active:scale-95"
        title="Install HyperPulse to home screen"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          id="pwa-ios-install-btn"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700 text-xs font-semibold hover:bg-slate-700 transition active:scale-95"
          title="Install on iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Add to Phone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold flex items-center gap-2 text-cyan-400">
                  <Smartphone className="w-5 h-5" /> Install on iOS
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-slate-300 space-y-2 leading-relaxed">
                1. Tap the <strong className="text-cyan-400">Share</strong> icon in Safari toolbar.<br />
                2. Scroll down and choose <strong className="text-cyan-400">Add to Home Screen</strong>.<br />
                3. Enjoy fullscreen offline gameplay with zero lag!
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-sm hover:bg-cyan-400 transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
