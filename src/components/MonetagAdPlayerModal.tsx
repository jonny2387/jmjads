import React, { useEffect, useState } from 'react';
import { Play, ShieldCheck, Sparkles, X, CheckCircle2 } from 'lucide-react';

interface MonetagAdPlayerModalProps {
  isOpen: boolean;
  zoneId: string;
  sdkFunc: string;
  rewardAmount: number;
  durationSeconds?: number;
  purposeLabel?: string;
  isDark: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export const MonetagAdPlayerModal: React.FC<MonetagAdPlayerModalProps> = ({
  isOpen,
  zoneId,
  sdkFunc,
  rewardAmount,
  durationSeconds = 5,
  purposeLabel = 'Monetag বিজ্ঞাপন',
  isDark,
  onSuccess,
  onCancel,
}) => {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTimeLeft(durationSeconds);
    setCompleted(false);

    try {
      const fn = (window as unknown as Record<string, unknown>)[sdkFunc];
      if (typeof fn === 'function') {
        Promise.resolve((fn as () => Promise<unknown>)()).catch(() => {});
      }
    } catch {}

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCompleted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, durationSeconds, sdkFunc]);

  if (!isOpen) return null;

  const progressPercent = Math.round(((durationSeconds - timeLeft) / durationSeconds) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#180a29]/65 backdrop-blur-lg p-5 animate-fadeIn">
      {/* Single unified glass surface — zero inner black boxes or dark borders */}
      <div
        className={`w-full max-w-sm rounded-3xl p-6 relative overflow-hidden glass-reflect border-2 transition-all ${
          isDark
            ? 'bg-gradient-to-br from-[#2a1448] via-[#1e0f36] to-[#2d1231] border-amber-400/45 text-amber-50 shadow-[0_20px_60px_rgba(245,158,11,0.25)]'
            : 'bg-gradient-to-br from-amber-50 via-white to-rose-50 border-amber-500/50 text-[#1c1026] shadow-[0_20px_60px_rgba(225,29,72,0.18)]'
        }`}
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-amber-500/30">
              {completed ? <CheckCircle2 className="w-5 h-5" /> : <Play className="w-4 h-4 fill-current" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold truncate">{purposeLabel}</div>
              <div className="text-[11px] opacity-75 font-mono-num truncate">
                Zone #{zoneId} · বোনাস +৳{rewardAmount}
              </div>
            </div>
          </div>

          {!completed && (
            <button
              type="button"
              onClick={onCancel}
              title="বাতিল করুন"
              className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center hover:bg-rose-500/25 shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Center Status Display (Unified — No inner box or dark frame) */}
        <div className="py-4 text-center">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-500 mx-auto flex items-center justify-center shadow-xl shadow-amber-500/30 mb-3.5">
            {completed ? (
              <ShieldCheck className="w-8 h-8 text-white" />
            ) : (
              <Sparkles className="w-8 h-8 text-white animate-pulse" />
            )}
          </div>

          <h4 className="text-lg font-extrabold tracking-tight">
            {completed ? 'বিজ্ঞাপন দেখা সম্পূর্ণ হয়েছে!' : `অপেক্ষা করুন (${timeLeft} সেকেন্ড)`}
          </h4>

          <p className="text-xs opacity-80 mt-1.5 px-2 leading-relaxed">
            {completed
              ? `নিচের বাটনে ট্যাপ করে আপনার +৳${rewardAmount} টাকা ব্যালেন্সে যোগ করুন।`
              : 'রিওয়ার্ড পেতে বিজ্ঞাপন শেষ হওয়া পর্যন্ত অপেক্ষা করুন।'}
          </p>
        </div>

        {/* Smooth Progress Line (No black track) */}
        <div className="my-4">
          <div className="flex justify-between text-xs font-mono-num font-bold text-amber-400 mb-1.5">
            <span>{completed ? '১০০% ভেরিফাইড' : 'লোড হচ্ছে...'}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-amber-500/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-rose-500 to-purple-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Action Button */}
        {completed ? (
          <button
            type="button"
            onClick={onSuccess}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500 text-[#14081f] font-extrabold text-sm shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-transform whitespace-nowrap"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>রিওয়ার্ড ক্লেইম করুন (+৳{rewardAmount})</span>
          </button>
        ) : (
          <div className="text-center text-xs font-semibold text-amber-400/90 pt-1">
            অটো-ভেরিফিকেশন চলছে · +৳{rewardAmount} BDT
          </div>
        )}
      </div>
    </div>
  );
};
