import React from 'react';
import { Bell, CheckCircle2, Flame, Gift, ShieldAlert, Sparkles, X } from 'lucide-react';
import { AppConfig, UserProfile } from '../types';

interface NoticeModalProps {
  isOpen: boolean;
  config: AppConfig;
  onClose: () => void;
}

export const NoticeModal: React.FC<NoticeModalProps> = ({ isOpen, config, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#180a29]/65 backdrop-blur-lg p-5 animate-fadeIn">
      <div className="w-full max-w-sm rounded-3xl p-6 border-2 max-h-[85vh] overflow-y-auto glass-reflect bg-gradient-to-br from-[#281344] via-[#1c0d32] to-[#29112d] border-amber-400/45 text-amber-50 shadow-[0_20px_60px_rgba(245,158,11,0.22)]">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-amber-500/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white shrink-0 shadow-md">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-amber-400 truncate">গুরুত্বপূর্ণ নোটিশ ও নিয়ম</h3>
              <p className="text-[11px] opacity-75 truncate">আয়ের নিয়ম ও পেমেন্ট রেট</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="my-4 space-y-3.5 text-xs leading-relaxed">
          <p className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25">
            👋 <b className="text-amber-400">{config.siteName}</b>-এ স্বাগতম! নিয়ম মেনে কাজ করুন, ১০০% পেমেন্ট নিশ্চিত।
          </p>

          <div className="space-y-1.5 px-1">
            <div className="font-bold text-amber-400">আয়ের রেটসমূহ:</div>
            <div>
              • <b>বিজ্ঞাপন ভিউ:</b> প্রতি বিজ্ঞাপনে <b className="text-amber-400">৳{config.adReward} টাকা</b>
            </div>
            <div>
              • <b>অ্যাড স্লট:</b> প্রতি <b className="text-amber-400">{config.adBatchCooldownHours} ঘণ্টা পর পর {config.adsPerBatchLimit}টি অ্যাড</b>
            </div>
            <div>
              • <b>রেফারেল বোনাস:</b> প্রতি রেফারে <b className="text-amber-400">৳{config.referralBonus} টাকা</b>
            </div>
            <div>
              • <b>অফিশিয়াল চ্যানেল বোনাস:</b> <b className="text-amber-400">৳{config.officialChannelReward} টাকা</b>
            </div>
          </div>

          <div className="space-y-1.5 px-1">
            <div className="font-bold text-amber-400">উত্তোলন (Withdraw) নিয়ম:</div>
            <div>
              • <b>ন্যূনতম উত্তোলন:</b> <b className="text-amber-400">৳{config.minWithdraw.toLocaleString('en-US')} টাকা</b>
            </div>
            <div>
              • <b>প্রয়োজনীয় রেফার:</b> কমপক্ষে <b className="text-amber-400">{config.requiredReferralsForWithdraw} জন</b>
            </div>
            <div>• <b>মাধ্যম:</b> bKash · Nagad · Rocket · Binance</div>
          </div>

          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>VPN ব্যবহার করবেন না এবং চ্যানেল সাবস্ক্রাইব না করে ক্লেইম চাপবেন না।</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500 text-[#14081f] font-extrabold text-sm shadow-lg shadow-amber-500/25 cursor-pointer"
        >
          বুঝেছি
        </button>
      </div>
    </div>
  );
};

interface BonusAndPromoModalProps {
  isOpen: boolean;
  user: UserProfile;
  onClaimStreak: (amount: number) => void;
  onRedeemPromo: (code: string) => void;
  onClose: () => void;
}

export const BonusAndPromoModal: React.FC<BonusAndPromoModalProps> = ({
  isOpen,
  user,
  onClaimStreak,
  onRedeemPromo,
  onClose,
}) => {
  const [promoInput, setPromoInput] = React.useState('');

  if (!isOpen) return null;

  const streakBonus = Math.min(10 + user.streakDays * 10, 100);
  const alreadyClaimedStreakToday = user.lastStreakDate === user.todayDateKey;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#180a29]/65 backdrop-blur-lg p-5 animate-fadeIn">
      <div className="w-full max-w-sm rounded-3xl p-6 border-2 glass-reflect bg-gradient-to-br from-[#281344] via-[#1c0d32] to-[#29112d] border-amber-400/45 text-amber-50 shadow-[0_20px_60px_rgba(245,158,11,0.22)]">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-amber-500/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-md">
              <Gift className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold truncate">ডেইলি বোনাস ও প্রোমো কোড</h3>
              <p className="text-[11px] opacity-75 truncate">প্রতিদিন ফ্রি চেক-ইন ও গিফট বোনাস</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Daily Streak Check-In */}
        <div className="my-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-extrabold flex items-center gap-1.5 text-amber-400 truncate">
                <Flame className="w-4 h-4 fill-current shrink-0" />
                <span>ডেইলি চেক-ইন (Day {user.streakDays + 1})</span>
              </div>
              <p className="text-xs opacity-85 mt-1">
                আজকের বোনাস: <b className="font-mono-num text-amber-400">+৳{streakBonus} BDT</b>
              </p>
            </div>

            <button
              type="button"
              disabled={alreadyClaimedStreakToday}
              onClick={() => onClaimStreak(streakBonus)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                alreadyClaimedStreakToday
                  ? 'bg-amber-500/15 text-amber-300/60 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-400 to-rose-500 text-[#14081f] shadow-md shadow-amber-500/25'
              }`}
            >
              {alreadyClaimedStreakToday ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> সম্পন্ন
                </span>
              ) : (
                `+৳${streakBonus} নিন`
              )}
            </button>
          </div>
        </div>

        {/* 2. Promo Code Box */}
        <div className="p-4 rounded-2xl bg-purple-500/10 border border-amber-500/25">
          <div className="text-xs font-extrabold mb-1.5 flex items-center gap-1.5 text-amber-400">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>অফিশিয়াল প্রোমো কোড</span>
          </div>
          <p className="text-[11px] opacity-80 mb-3">
            অফিশিয়াল চ্যানেল (@jmjads) থেকে পাওয়া প্রোমো কোড নিচে বসিয়ে বোনাস নিন।
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              placeholder="প্রোমো কোড লিখুন..."
              className="flex-1 min-w-0 rounded-xl px-3.5 py-2.5 text-xs font-mono-num font-bold outline-none border bg-[#170b28] border-amber-500/35 text-amber-50"
            />
            <button
              type="button"
              onClick={() => {
                if (promoInput.trim()) {
                  onRedeemPromo(promoInput.trim());
                  setPromoInput('');
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 text-white text-xs font-extrabold cursor-pointer whitespace-nowrap shrink-0"
            >
              ক্লেইম
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
