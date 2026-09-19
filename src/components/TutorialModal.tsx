import React, { useState } from 'react';
import { X, CheckCircle2, ChevronRight, ChevronLeft, Target, AlertTriangle, Sparkles, Swords } from 'lucide-react';
import { UserProfile } from '../types';
import { translations } from '../i18n/translations';
import { soundEngine } from '../services/audio';

interface TutorialModalProps {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({
  profile,
  isOpen,
  onClose,
}) => {
  const [step, setStep] = useState(0);
  const t = translations[profile.language] || translations.en;
  const isDark = profile.theme === 'dark';

  if (!isOpen) return null;

  const steps = [
    {
      title: t.tutorial_step1_title,
      desc: t.tutorial_step1_desc,
      icon: <Target className="w-8 h-8 text-cyan-400" />,
      visual: (
        <div className="relative w-28 h-28 mx-auto my-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-75" />
          <div className="absolute inset-2 rounded-full border border-dashed border-cyan-300 animate-spin" />
          <div className="w-14 h-14 rounded-full bg-cyan-500 shadow-[0_0_20px_#06b6d4] flex items-center justify-center font-black text-slate-950 text-xs">
            PERFECT!
          </div>
        </div>
      ),
    },
    {
      title: t.tutorial_step2_title,
      desc: t.tutorial_step2_desc,
      icon: <AlertTriangle className="w-8 h-8 text-rose-500" />,
      visual: (
        <div className="relative w-28 h-28 mx-auto my-4 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-rose-600 shadow-[0_0_20px_#f43f5e] flex items-center justify-center border-2 border-red-400 animate-bounce">
            <AlertTriangle className="w-7 h-7 text-white" />
          </div>
        </div>
      ),
    },
    {
      title: t.tutorial_step3_title,
      desc: t.tutorial_step3_desc,
      icon: <Sparkles className="w-8 h-8 text-amber-400" />,
      visual: (
        <div className="flex items-center justify-center gap-4 my-4">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-slate-950 font-bold text-xs shadow-lg">
              3X
            </div>
            <span className="text-[10px] text-amber-400 mt-1 font-bold">Fever</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center text-white font-bold text-xs shadow-lg">
              SLO
            </div>
            <span className="text-[10px] text-cyan-400 mt-1 font-bold">Freeze</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-xs shadow-lg">
              DEF
            </div>
            <span className="text-[10px] text-purple-400 mt-1 font-bold">Shield</span>
          </div>
        </div>
      ),
    },
    {
      title: t.tutorial_step4_title,
      desc: t.tutorial_step4_desc,
      icon: <Swords className="w-8 h-8 text-indigo-400" />,
      visual: (
        <div className="w-36 h-28 mx-auto my-3 rounded-xl border border-slate-700 bg-slate-950 flex flex-col overflow-hidden shadow-inner">
          <div className="flex-1 bg-rose-500/20 border-b border-slate-700 flex items-center justify-center text-[10px] text-rose-300 font-bold rotate-180">
            Player 2 (Top)
          </div>
          <div className="h-2 bg-amber-500" />
          <div className="flex-1 bg-cyan-500/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">
            Player 1 (Bottom)
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];

  const handleNext = () => {
    soundEngine.playTap();
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    soundEngine.playTap();
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {current.icon}
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              Tutorial ({step + 1}/{steps.length})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <h3 className="text-lg font-black tracking-tight mb-2">{current.title}</h3>
        {current.visual}
        <p className="text-xs leading-relaxed text-slate-300 min-h-[56px] text-center px-2">
          {current.desc}
        </p>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 my-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-cyan-400' : 'w-2 bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center gap-2 pt-2">
          {step > 0 && (
            <button
              onClick={handlePrev}
              className="py-2.5 px-4 rounded-xl border border-slate-700 text-xs font-bold text-slate-300 hover:bg-slate-800 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-cyan-400 transition"
          >
            {step === steps.length - 1 ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> {t.got_it}
              </>
            ) : (
              <>
                <span>Next</span> <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
